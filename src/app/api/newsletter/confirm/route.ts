import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Clicked from the confirmation email. Redirects to a human-readable page
 * rather than returning JSON — the browser is the client here.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const origin = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/newsletter/confirmed?status=invalid`);
  }

  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from('newsletter_subscribers')
      .select('id, is_confirmed')
      .eq('confirmation_token', token)
      .maybeSingle();

    if (!data) {
      return NextResponse.redirect(`${origin}/newsletter/confirmed?status=invalid`);
    }

    if (!(data as { is_confirmed: boolean }).is_confirmed) {
      await admin
        .from('newsletter_subscribers')
        .update({
          is_confirmed: true,
          confirmed_at: new Date().toISOString(),
          unsubscribed_at: null,
          // Burn the token so the link is single-use.
          confirmation_token: null,
        })
        .eq('id', (data as { id: string }).id);
    }

    return NextResponse.redirect(`${origin}/newsletter/confirmed?status=ok`);
  } catch (error) {
    console.error('[newsletter/confirm]', error);
    return NextResponse.redirect(`${origin}/newsletter/confirmed?status=error`);
  }
}
