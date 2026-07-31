import type { MembershipTier } from './types';

export interface TierConfig {
  id: MembershipTier;
  name: string;
  /** Monthly price in USD. Placeholder values — confirm with Dan. */
  price: number;
  tagline: string;
  perks: string[];
  /** Goal slots unlocked per category. Mirrors enforce_goal_tier_limit(). */
  goalSlots: number;
  canComment: boolean;
  canViewDirectory: boolean;
  /** Env var holding the Stripe price ID. Free tier has no price. */
  priceEnvKey?: 'STRIPE_PRICE_SUPPORTER' | 'STRIPE_PRICE_MEMBER' | 'STRIPE_PRICE_FOUNDING';
}

export const TIERS: Record<MembershipTier, TierConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    tagline: 'Read along and start mapping your goals.',
    perks: ['Read the blog', 'Public profile', '2 living + 2 dying goals'],
    goalSlots: 2,
    canComment: false,
    canViewDirectory: false,
  },
  supporter: {
    id: 'supporter',
    name: 'Supporter',
    price: 5,
    tagline: 'Join the conversation.',
    perks: ['Everything in Free', 'All 5 + 5 goal slots', 'Comment on blog posts', 'Member directory'],
    goalSlots: 5,
    canComment: true,
    canViewDirectory: true,
    priceEnvKey: 'STRIPE_PRICE_SUPPORTER',
  },
  member: {
    id: 'member',
    name: 'Member',
    price: 15,
    tagline: 'The full community.',
    perks: ['Everything in Supporter', 'Priority content', 'Private community features'],
    goalSlots: 5,
    canComment: true,
    canViewDirectory: true,
    priceEnvKey: 'STRIPE_PRICE_MEMBER',
  },
  founding: {
    id: 'founding',
    name: 'Founding',
    price: 50,
    tagline: 'Help build this thing.',
    perks: ['Everything in Member', 'Founding badge', 'Direct access to Dan', 'Legacy recognition'],
    goalSlots: 5,
    canComment: true,
    canViewDirectory: true,
    priceEnvKey: 'STRIPE_PRICE_FOUNDING',
  },
};

export const PAID_TIERS: MembershipTier[] = ['supporter', 'member', 'founding'];

export const TIER_ORDER: MembershipTier[] = ['free', 'supporter', 'member', 'founding'];

export function isValidTier(value: string | null | undefined): value is MembershipTier {
  return value != null && value in TIERS;
}

export function tierConfig(tier: MembershipTier | null | undefined): TierConfig {
  return TIERS[tier ?? 'free'] ?? TIERS.free;
}

export function goalSlots(tier: MembershipTier | null | undefined): number {
  return tierConfig(tier).goalSlots;
}

export function canComment(tier: MembershipTier | null | undefined): boolean {
  return tierConfig(tier).canComment;
}

export function canViewDirectory(tier: MembershipTier | null | undefined): boolean {
  return tierConfig(tier).canViewDirectory;
}

/** Ranks tiers so webhook handlers can log upgrade vs downgrade. */
export function tierRank(tier: MembershipTier): number {
  return TIER_ORDER.indexOf(tier);
}
