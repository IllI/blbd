import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { APP_URL } from '@/lib/env';
import { corsHeaders, preflight } from '@/lib/cors';

/**
 * Hands the member off to Stripe's hosted Customer Portal so they can update
 * their card, switch plan, or cancel — no billing UI for us to build.
 */
export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  // Cookie (portal) or Bearer token (Webflow SDK) — the SDK calls cross-origin.
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: 'You need to be logged in.' }, { status: 401, headers: corsHeaders(request) });
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account yet — choose a membership tier first.' },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/settings`,
    });

    return NextResponse.json({ url: session.url }, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('[stripe/portal]', error);
    return NextResponse.json({ error: 'Could not open the billing portal.' }, { status: 500, headers: corsHeaders(request) });
  }
}
