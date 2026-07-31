import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidEmail } from '@/lib/utils';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** One-click unsubscribe from an email link carrying the stable token. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const origin = request.nextUrl.origin;

  if (!token) return NextResponse.redirect(`${origin}/newsletter/unsubscribe`);

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('newsletter_subscribers')
      .select('id')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (data) {
      await admin
        .from('newsletter_subscribers')
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq('id', (data as { id: string }).id);
    }

    return NextResponse.redirect(`${origin}/newsletter/unsubscribe?done=1`);
  } catch (error) {
    console.error('[newsletter/unsubscribe GET]', error);
    return NextResponse.redirect(`${origin}/newsletter/unsubscribe?error=1`);
  }
}

/** Fallback: unsubscribe by typing the address on the form page. */
export async function POST(request: Request) {
  if (!rateLimit(`unsub:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ success: false, error: 'Too many attempts.' }, { status: 429 });
  }

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ success: false, error: 'Enter a valid email.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    // Always report success so the form can't be used to probe the list.
    await admin
      .from('newsletter_subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('email', email.trim().toLowerCase());

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[newsletter/unsubscribe POST]', error);
    return NextResponse.json({ success: false, error: 'Please try again.' }, { status: 500 });
  }
}
