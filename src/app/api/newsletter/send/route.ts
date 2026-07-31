import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResend, fromAddress, emailShell, escapeHtml } from '@/lib/resend';
import { APP_URL } from '@/lib/env';

export const runtime = 'nodejs';
// Sending to the whole list can take a while on a big batch.
export const maxDuration = 60;

/** Resend accepts up to 100 recipients per call. */
const BATCH_SIZE = 50;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // Admin check runs against the caller's own JWT, so RLS applies.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!(profile as { is_admin: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  }

  let subject: unknown;
  let body: unknown;
  let testOnly: unknown;
  try {
    ({ subject, body, testOnly } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (typeof subject !== 'string' || !subject.trim()) {
    return NextResponse.json({ error: 'A subject line is required.' }, { status: 400 });
  }
  if (typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'The newsletter body is empty.' }, { status: 400 });
  }

  try {
    const resend = getResend();

    // Plain-text composition, rendered as paragraphs. Escaping first means an
    // admin can't accidentally paste markup that breaks the template.
    const html = emailShell(
      body
        .trim()
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
        .join(''),
      subject.trim(),
    );

    if (testOnly === true) {
      await resend.emails.send({
        from: fromAddress(),
        to: user.email!,
        subject: `[TEST] ${subject.trim()}`,
        html,
      });
      return NextResponse.json({ sent: 1, test: true });
    }

    const admin = createAdminClient();
    const { data: subscribers, error } = await admin
      .from('newsletter_subscribers')
      .select('email')
      .eq('is_confirmed', true)
      .is('unsubscribed_at', null);

    if (error) throw error;

    const recipients = (subscribers ?? []).map((row) => (row as { email: string }).email);
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No confirmed subscribers yet.' }, { status: 400 });
    }

    let sent = 0;
    for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
      const batch = recipients.slice(index, index + BATCH_SIZE);

      // BCC, not `to`: recipients must not see each other's addresses.
      await resend.emails.send({
        from: fromAddress(),
        to: fromAddress(),
        bcc: batch,
        subject: subject.trim(),
        html: `${html}<p style="font-size:12px;color:#96a9b3;text-align:center;">
          <a href="${APP_URL}/newsletter/unsubscribe">Unsubscribe</a></p>`,
      });

      sent += batch.length;
    }

    return NextResponse.json({ sent });
  } catch (error) {
    console.error('[newsletter/send]', error);
    return NextResponse.json({ error: 'Send failed. Check the server logs.' }, { status: 500 });
  }
}
