import { NextResponse } from 'next/server';
import { APP_URL } from '@/lib/env';
import { betaIsIsolated } from '@/lib/admin/environment';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/redirects';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
const WEBFLOW = 'https://blbd.webflow.io';
const PORTAL = 'https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app';

/** Top-level, URL-encoded form POST establishes first-party portal cookies.
 * No cross-site cookie fetch, password in a URL, or token handoff is needed.
 * Keep the native Webflow UI until the native member pages have full parity. */
export async function POST(request: Request) {
  const reply = (path: string, code?: string, next = '/dashboard') => {
    const url = new URL(path, WEBFLOW);
    if (code) url.searchParams.set('auth_status', code);
    if (next !== '/dashboard') url.searchParams.set('next', next);
    return NextResponse.redirect(url, { status: 303, headers: {
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    } });
  };
  if (!betaIsIsolated() || APP_URL !== PORTAL) return new Response('Beta authentication unavailable.', { status: 503 });
  // Fail closed on immutable aliases: never put a verifier/session on the wrong host.
  if (new URL(request.url).origin !== PORTAL) return new Response('Use the beta portal host.', { status: 400 });
  // Browsers attach Origin to form POSTs. A hostile site cannot submit a login
  // or create an account in the visitor's browser (login CSRF).
  if (request.headers.get('origin') !== WEBFLOW) return new Response('Forbidden origin.', { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') {
    return new Response('Use an encoded form.', { status: 415 });
  }
  if (!rateLimit(`native-password:${clientIp(request)}`, 10, 15 * 60_000)) return reply('/log-in', 'rate_limited');
  // Enforce the actual streamed byte count, not just a forgeable Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return new Response('Missing form.', { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) { await reader.cancel(); return new Response('Form too large.', { status: 413 }); }
    chunks.push(value);
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  for (const key of ['mode', 'email', 'password', 'name', 'privacy', 'marketing', 'next']) {
    if (form.getAll(key).length > 1) return new Response('Duplicate form field.', { status: 400 });
  }
  const mode = form.get('mode');
  if (mode !== 'login' && mode !== 'signup') return new Response('Invalid form.', { status: 400 });
  const path = mode === 'login' ? '/log-in' : '/sign-up';
  const requested = form.get('next');
  const next = requested && /[\x00-\x20\x7f\\]/.test(requested) ? '/dashboard' : safeNext(requested);
  const email = (form.get('email') || '').trim();
  const password = form.get('password') || '';
  const name = (form.get('name') || '').trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || email.length > 254 || !password || password.length > 256) {
    return reply(path, 'invalid_fields', next);
  }
  if (mode === 'signup' && (password.length < 8 || !name || name.length > 120 || form.get('privacy') !== 'yes')) {
    return reply(path, 'signup_fields', next);
  }
  try {
    const db = await createClient();
    if (mode === 'login') {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error || !data.session) return reply(path, error?.code === 'email_not_confirmed' ? 'confirm_email' : 'invalid_credentials', next);
      return NextResponse.redirect(new URL(next, PORTAL), { status: 303, headers: { 'Cache-Control': 'no-store' } });
    }
    // PKCE verifier and confirmation both live on the portal's first-party host.
    const callback = new URL('/auth/callback', PORTAL);
    callback.searchParams.set('next', next);
    const { error } = await db.auth.signUp({ email, password, options: {
      emailRedirectTo: callback.toString(),
      // Never accept roles, tiers, verification or admin claims from form data.
      data: { display_name: name, privacy_accepted: true, marketing_consent: form.get('marketing') === 'yes' },
    } });
    if (error) return reply(path, error.code === 'over_email_send_rate_limit' || error.status === 429 ? 'rate_limited' : 'signup_failed', next);
    // Do not imply verification, list subscription or admin access. Supabase's
    // non-enumerating duplicate-account response gets the same acknowledgement.
    return reply(path, 'check_email', next);
  } catch { return reply(path, 'unavailable', next); }
}
