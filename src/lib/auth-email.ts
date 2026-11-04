import 'server-only';
import { createHash } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import { betaIsIsolated } from '@/lib/admin/environment';

type HookPayload = {
  user: { email: string; new_email?: string };
  email_data: { email_action_type: string; token?: string; token_hash?: string;
    token_new?: string; token_hash_new?: string; redirect_to?: string };
};
const subjects: Record<string, string> = {
  signup: 'Confirm your BLBD beta account', recovery: 'Reset your BLBD beta password',
  magiclink: 'Sign in to BLBD beta', invite: 'Your BLBD beta invitation',
  email_change: 'Confirm your BLBD beta email change', reauthentication: 'Your BLBD beta security code',
};

/** URLs are constructed from trusted configuration, never payload site_url. */
export function authMessages(payload: HookPayload) {
  const { user, email_data: data } = payload;
  const subject = subjects[data?.email_action_type];
  if (!subject || !user?.email) throw new Error('Unsupported auth email');
  const app = new URL(process.env.NEXT_PUBLIC_APP_URL!);
  if (app.protocol !== 'https:') throw new Error('HTTPS required');
  let redirect = new URL('/auth/confirm', app);
  if (data.email_action_type === 'recovery') redirect.searchParams.set('next', '/settings');
  if (data.redirect_to) {
    const candidate = new URL(data.redirect_to);
    // Fail closed on arbitrary links. Only the beta app's auth landing pages
    // may receive a session; the landing page sanitizes its own next parameter.
    if (candidate.origin !== app.origin || !['/auth/confirm', '/auth/callback'].includes(candidate.pathname)) {
      throw new Error('Untrusted auth redirect');
    }
    redirect = candidate;
  }
  const message = (to: string, hash?: string, token?: string) => {
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to)) throw new Error('Invalid recipient');
    if (data.email_action_type === 'reauthentication') {
      if (!token || !/^\d{6,10}$/.test(token)) throw new Error('Missing security code');
      return { to, subject, text: `Your BLBD beta security code is: ${token}\n\nIf you did not request this, ignore this email.` };
    }
    if (!hash || !/^[a-zA-Z0-9_-]{20,256}$/.test(hash)) throw new Error('Missing auth token');
    const url = new URL('/auth/v1/verify', process.env.NEXT_PUBLIC_SUPABASE_URL);
    url.searchParams.set('token', hash);
    url.searchParams.set('type', data.email_action_type);
    url.searchParams.set('redirect_to', redirect.toString());
    return { to, subject, text: `${subject}\n\nContinue securely:\n${url}\n\nThis link expires. If you did not request this, ignore this email.\n\nThis is the BLBD testing environment, not your production account.` };
  };
  if (data.email_action_type === 'email_change') {
    if (!user.new_email) throw new Error('Missing new email');
    // Supabase's backwards-compatible names are counterintuitive:
    // token_hash_new belongs to the CURRENT email, token_hash to the NEW one.
    return [
      ...(data.token_hash_new ? [message(user.email, data.token_hash_new, data.token)] : []),
      message(user.new_email, data.token_hash, data.token_new || data.token),
    ];
  }
  return [message(user.email, data.token_hash, data.token)];
}

function failure(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status });
}

export async function handleAuthEmail(request: Request): Promise<Response> {
  if (!betaIsIsolated()) return failure(503, 'Beta auth email is unavailable.');
  const secret = process.env.SUPABASE_AUTH_EMAIL_HOOK_SECRET?.trim().replace(/^v1,/, '');
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!secret || !key || /placeholder/i.test(key) || !from || !/^BLBD Beta <[^\s<>@]+@blbd\.life>$/.test(from)) {
    return failure(503, 'Beta auth email configuration is incomplete.');
  }
  if (Number(request.headers.get('content-length')) > 65536) return failure(413, 'Payload too large.');
  const body = await request.text();
  if (Buffer.byteLength(body) > 65536) return failure(413, 'Payload too large.');
  let payload: HookPayload;
  try {
    // Includes timestamp tolerance and constant-time signature verification.
    payload = new Webhook(secret).verify(body, Object.fromEntries(request.headers)) as HookPayload;
  } catch { return failure(401, 'Invalid auth email signature.'); }
  let messages;
  try { messages = authMessages(payload); }
  catch { return failure(400, 'Invalid auth email payload.'); }
  try {
    await Promise.all(messages.map(async message => {
      const id = createHash('sha256').update(`${request.headers.get('webhook-id')}:${message.to}`).digest('hex');
      const result = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(3500),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `beta-auth/${id}` },
        body: JSON.stringify({ from, ...message, reply_to: 'contact@blbd.life' }),
      });
      // Never log tokens, addresses, raw provider responses, or the API key.
      if (!result.ok) {
        console.error('[beta-auth-email] Provider rejected request:', result.status);
        throw new Error('Provider rejected request');
      }
      const data = await result.json();
      if (!data.id) throw new Error('Missing provider acceptance');
    }));
  } catch { return failure(502, 'Could not send the confirmation email. Please try again later.'); }
  return Response.json({});
}
