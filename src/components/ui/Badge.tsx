import type { MembershipTier } from '@/lib/types';
import { tierConfig } from '@/lib/tiers';

export function TierBadge({ tier }: { tier: MembershipTier | null | undefined }) {
  const config = tierConfig(tier);
  return <span className={`badge badge--${config.id}`}>{config.name}</span>;
}
