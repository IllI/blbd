import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireEnv } from '@/lib/env';
import { tierRank } from '@/lib/tiers';
import type { MembershipEventType, MembershipTier } from '@/lib/types';

// Signature verification needs the exact bytes Stripe signed, so this route
// must never be statically analysed/cached and must read the raw body.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Reverse lookup: Stripe price ID → BLBD tier. Built once per cold start. */
function priceToTier(priceId: string | null | undefined): MembershipTier | null {
  if (!priceId) return null;
  const map: Record<string, MembershipTier> = {};
  if (process.env.STRIPE_PRICE_SUPPORTER) map[process.env.STRIPE_PRICE_SUPPORTER] = 'supporter';
  if (process.env.STRIPE_PRICE_MEMBER) map[process.env.STRIPE_PRICE_MEMBER] = 'member';
  if (process.env.STRIPE_PRICE_FOUNDING) map[process.env.STRIPE_PRICE_FOUNDING] = 'founding';
  return map[priceId] ?? null;
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET'),
    );
  } catch (error) {
    console.error('[stripe/webhook] signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    // A non-2xx tells Stripe to retry, which is what we want for transient
    // database failures.
    console.error(`[stripe/webhook] ${event.type} failed`, error);
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event) {
  const admin = createAdminClient();

  /** Resolves the BLBD user for a Stripe customer, via metadata or the stored id. */
  async function findUserId(
    customerId: string | null,
    metadataUserId?: string | null,
  ): Promise<string | null> {
    if (metadataUserId) return metadataUserId;
    if (!customerId) return null;

    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    return (data as { id: string } | null)?.id ?? null;
  }

  async function logEvent(
    userId: string,
    eventType: MembershipEventType,
    metadata: Record<string, unknown>,
  ) {
    await admin.from('membership_events').insert({
      user_id: userId,
      event_type: eventType,
      metadata: { stripe_event_id: event.id, ...metadata },
    });
  }

  async function applyTier(
    userId: string,
    tier: MembershipTier,
    subscriptionId: string | null,
    customerId: string | null,
  ) {
    const { data } = await admin
      .from('profiles')
      .select('membership_tier')
      .eq('id', userId)
      .single();

    const previous = ((data as { membership_tier: MembershipTier } | null)?.membership_tier ??
      'free') as MembershipTier;

    await admin
      .from('profiles')
      .update({
        membership_tier: tier,
        stripe_subscription_id: subscriptionId,
        ...(customerId ? { stripe_customer_id: customerId } : {}),
      })
      .eq('id', userId);

    if (previous === tier) return;

    const eventType: MembershipEventType =
      tier === 'free' ? 'cancel' : tierRank(tier) > tierRank(previous) ? 'upgrade' : 'downgrade';

    await logEvent(userId, eventType, { from: previous, to: tier });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = await findUserId(
        typeof session.customer === 'string' ? session.customer : null,
        session.metadata?.supabase_user_id,
      );
      if (!userId) break;

      await logEvent(userId, 'payment', {
        amount_total: session.amount_total,
        currency: session.currency,
        mode: session.mode,
      });
      // The tier itself is applied by customer.subscription.created/updated,
      // which carries the authoritative price. Doing it in one place keeps
      // the two events from racing to opposite answers.
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
      const userId = await findUserId(customerId, subscription.metadata?.supabase_user_id);
      if (!userId) break;

      const priceId = subscription.items.data[0]?.price?.id;
      const tier = priceToTier(priceId);

      if (!tier) {
        console.warn(`[stripe/webhook] no tier mapped for price ${priceId}`);
        break;
      }

      // `active` and `trialing` grant access; anything else (past_due,
      // unpaid, canceled, incomplete) does not.
      const entitled = subscription.status === 'active' || subscription.status === 'trialing';

      await applyTier(userId, entitled ? tier : 'free', subscription.id, customerId);
      await logEvent(
        userId,
        event.type === 'customer.subscription.created'
          ? 'subscription_created'
          : 'subscription_updated',
        { status: subscription.status, price_id: priceId },
      );
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
      const userId = await findUserId(customerId, subscription.metadata?.supabase_user_id);
      if (!userId) break;

      await applyTier(userId, 'free', null, customerId);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
      const userId = await findUserId(customerId);
      if (!userId) break;

      await logEvent(userId, 'payment', {
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        invoice_id: invoice.id,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
      const userId = await findUserId(customerId);
      if (!userId) break;

      await logEvent(userId, 'payment_failed', {
        amount_due: invoice.amount_due,
        invoice_id: invoice.id,
      });
      break;
    }

    default:
      // Everything else is ignored on purpose; Stripe still gets its 200.
      break;
  }
}
