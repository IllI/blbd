import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResend, fromAddress, emailShell, escapeHtml } from '@/lib/resend';
import { isValidEmail } from '@/lib/utils';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { APP_URL } from '@/lib/env';
import { corsHeaders, preflight } from '@/lib/cors';

export const runtime = 'nodejs';

export async function OPTIONS(request: Request) {
  // The Webflow form posts JSON cross-origin, which triggers a preflight.
  return preflight(request);
}

/** Wraps a JSON body with the caller-specific CORS headers. */
function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  if (!rateLimit(`newsletter:${clientIp(request)}`, 5, 60_000)) {
    return json(request, { success: false, error: 'Too many attempts. Try again in a minute.' }, 429);
  }

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return json(request, { success: false, error: 'Invalid request.' }, 400);
  }

  if (typeof email !== 'string' || !isValidEmail(email)) {
    return json(request, { success: false, error: "That doesn't look like a valid email address." }, 400);
  }

  const normalized = email.trim().toLowerCase();

  try {
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from('newsletter_subscribers')
      .select('id, is_confirmed, confirmation_token')
      .eq('email', normalized)
      .maybeSingle();

    let token = (existing as { confirmation_token: string | null } | null)?.confirmation_token;

    if (existing) {
      // Already confirmed: say the same thing either way so the endpoint
      // can't be used to test whether an address is on the list.
      if ((existing as { is_confirmed: boolean }).is_confirmed) {
        return json(request, { success: true });
      }

      // Re-subscribing after an unsubscribe clears the tombstone.
      await admin
        .from('newsletter_subscribers')
        .update({ unsubscribed_at: null })
        .eq('id', (existing as { id: string }).id);
    } else {
      const { data: created, error } = await admin
        .from('newsletter_subscribers')
        .insert({ email: normalized })
        .select('confirmation_token')
        .single();

      if (error) throw error;
      token = (created as { confirmation_token: string }).confirmation_token;
    }

    if (!token) throw new Error('No confirmation token available');

    const confirmUrl = `${APP_URL}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;

    await getResend().emails.send({
      from: fromAddress(),
      to: normalized,
      subject: 'Confirm your BLBD subscription',
      html: emailShell(
        `<p>One click and you&rsquo;re in.</p>
         <p>We write about living well and dying well &mdash; no more than you&rsquo;d want in your inbox.</p>
         <p style="margin:24px 0;">
           <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#48468c;color:#ffffff;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;">Confirm subscription</a>
         </p>
         <p style="font-size:13px;color:#69778c;">If you didn&rsquo;t sign up, ignore this email and nothing happens.</p>`,
        'Confirm your BLBD subscription',
      ),
    });

    return json(request, { success: true });
  } catch (error) {
    console.error('[newsletter/subscribe]', error);
    return json(request, { success: false, error: 'Could not sign you up right now. Please try again.' }, 500);
  }
}
