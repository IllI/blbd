import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { isValidTier, TIERS } from '@/lib/tiers';
import { APP_URL, SITE_URL, requireEnv } from '@/lib/env';
import { corsHeaders, preflight } from '@/lib/cors';
import type { Profile } from '@/lib/types';

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const cors = corsHeaders(request);

  let tier: unknown;
  let returnTo: unknown;
  try {
    ({ tier, returnTo } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400, headers: cors });
  }

  if (typeof tier !== 'string' || !isValidTier(tier) || tier === 'free') {
    return NextResponse.json({ error: 'Unknown membership tier.' }, { status: 400, headers: cors });
  }

  // Cookie (portal) or Bearer token (Webflow SDK). Never trust a user id in
  // the body — the token/cookie is verified by Supabase.
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: 'You need to be logged in.' }, { status: 401, headers: cors });
  }

  const priceEnvKey = TIERS[tier].priceEnvKey;
  if (!priceEnvKey) {
    return NextResponse.json({ error: 'That tier is not purchasable.' }, { status: 400, headers: cors });
  }

  try {
    const priceId = requireEnv(priceEnvKey);
    const stripe = getStripe();
    const admin = createAdminClient();

    const { data } = await admin
      .from('profiles')
      .select('stripe_customer_id, display_name')
      .eq('id', user.id)
      .single();

    const profile = data as Pick<Profile, 'stripe_customer_id' | 'display_name'> | null;
    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: profile?.display_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      // Persist immediately so a failure after this point doesn't orphan the
      // Stripe customer and create a duplicate on the next attempt.
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // Land back on the Webflow page the member started from when the SDK
    // supplies it; fall back to the portal checkout page otherwise. Only same
    // -origin (blbd.life / *.blbd.life) targets are honoured.
    const landing = safeReturn(returnTo);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: landing ? `${landing}?blbd_checkout=success` : `${APP_URL}/checkout?success=1`,
      cancel_url: landing ? `${landing}?blbd_checkout=canceled` : `${APP_URL}/checkout?canceled=1`,
      allow_promotion_codes: true,
      // Read back by the webhook to map the payment to a profile and tier.
      metadata: { supabase_user_id: user.id, tier },
      subscription_data: { metadata: { supabase_user_id: user.id, tier } },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502, headers: cors });
    }

    return NextResponse.json({ url: session.url }, { headers: cors });
  } catch (error) {
    console.error('[stripe/create-checkout]', error);
    return NextResponse.json({ error: 'Could not start checkout.' }, { status: 500, headers: cors });
  }
}

/** Accepts only http(s) URLs on blbd.life / *.blbd.life to avoid open redirects. */
function safeReturn(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const siteHost = new URL(SITE_URL).hostname;
    if (url.hostname === siteHost || url.hostname.endsWith('.blbd.life') || url.hostname.endsWith('.webflow.io')) {
      return url.origin + url.pathname;
    }
  } catch {
    /* not a URL */
  }
  return null;
}
