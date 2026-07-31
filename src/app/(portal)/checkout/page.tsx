import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { TierPicker } from '@/components/billing/TierPicker';
import { Alert } from '@/components/ui/Alert';
import { isValidTier } from '@/lib/tiers';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Membership' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; canceled?: string; success?: string }>;
}) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect('/login');

  const params = await searchParams;
  const preselected = isValidTier(params.tier) ? params.tier : null;

  return (
    <div className="stack-lg">
      <header className="page-header">
        <h1>Membership</h1>
        <p>
          BLBD runs on member support. Pick what fits — you can change or cancel any time from
          settings.
        </p>
      </header>

      {params.success && (
        <Alert tone="success">
          Payment received. Your tier updates as soon as Stripe confirms it — usually a few seconds.
          Refresh if it still looks stale.
        </Alert>
      )}
      {params.canceled && <Alert tone="info">Checkout canceled. Nothing was charged.</Alert>}

      <TierPicker
        currentTier={(profile as Profile | null)?.membership_tier ?? 'free'}
        preselected={preselected}
      />
    </div>
  );
}
