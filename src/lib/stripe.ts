import 'server-only';
import Stripe from 'stripe';
import { requireEnv } from '@/lib/env';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cached) {
    cached = new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
      // Pin the version so a Stripe-side upgrade can't change payload shapes
      // underneath the webhook handler.
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
    });
  }
  return cached;
}
