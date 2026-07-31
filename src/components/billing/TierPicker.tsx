'use client';

import { useState } from 'react';
import type { MembershipTier } from '@/lib/types';
import { TIER_ORDER, TIERS, tierRank } from '@/lib/tiers';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function TierPicker({
  currentTier,
  preselected,
}: {
  currentTier: MembershipTier;
  preselected: MembershipTier | null;
}) {
  const [pending, setPending] = useState<MembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(tier: MembershipTier) {
    setPending(tier);
    setError(null);

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? 'Could not start checkout. Please try again.');
        setPending(null);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError('Network error. Please try again.');
      setPending(null);
    }
  }

  return (
    <div className="stack">
      {error && <Alert tone="error">{error}</Alert>}

      <div className="tier-grid">
        {TIER_ORDER.map((id) => {
          const tier = TIERS[id];
          const isCurrent = id === currentTier;
          const isDowngrade = tierRank(id) < tierRank(currentTier);

          return (
            <article
              key={id}
              className="tier-card"
              data-current={isCurrent || undefined}
              data-preselected={preselected === id || undefined}
            >
              <div>
                <h2 style={{ fontSize: '1.0625rem' }}>{tier.name}</h2>
                <p className="small muted">{tier.tagline}</p>
              </div>

              <div className="tier-card__price">
                ${tier.price}
                <span>{tier.price === 0 ? '' : '/mo'}</span>
              </div>

              <ul className="tier-card__perks">
                {tier.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>

              <div className="tier-card__cta">
                {isCurrent ? (
                  <Button variant="secondary" block disabled>
                    Current plan
                  </Button>
                ) : id === 'free' ? (
                  <p className="tiny muted">
                    Cancel your subscription in settings to return to free.
                  </p>
                ) : (
                  <Button
                    block
                    variant={isDowngrade ? 'secondary' : 'primary'}
                    loading={pending === id}
                    disabled={pending !== null}
                    onClick={() => startCheckout(id)}
                  >
                    {isDowngrade ? `Switch to ${tier.name}` : `Choose ${tier.name}`}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="tiny muted">
        Payments are handled by Stripe. BLBD never sees your card details.
      </p>
    </div>
  );
}
