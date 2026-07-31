import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { TierBadge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { ManageBillingButton } from '@/components/billing/ManageBillingButton';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { tierConfig } from '@/lib/tiers';
import { formatDate } from '@/lib/utils';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect('/login');

  const typed = profile as Profile | null;
  const tier = typed?.membership_tier ?? 'free';
  const cameFromReset = (await searchParams).reset === '1';

  return (
    <div className="stack-lg">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      {cameFromReset && (
        <Alert tone="info">You&apos;re signed in. Set a new password below.</Alert>
      )}

      <Card title="Account">
        <dl className="stack-sm" style={{ margin: 0 }}>
          <div className="row-between">
            <dt className="small muted">Email</dt>
            <dd style={{ margin: 0 }}>{user.email}</dd>
          </div>
          <div className="row-between">
            <dt className="small muted">Member since</dt>
            <dd style={{ margin: 0 }}>{formatDate(typed?.created_at)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Membership">
        <div className="row-between wrap">
          <div>
            <TierBadge tier={tier} />
            <p className="small muted" style={{ marginTop: '0.5rem' }}>
              {tierConfig(tier).tagline}
              {tier !== 'free' && ` · $${tierConfig(tier).price}/month`}
            </p>
          </div>

          <div className="row wrap">
            <Link className="btn btn--secondary" href="/checkout">
              {tier === 'free' ? 'See the tiers' : 'Change plan'}
            </Link>
            {typed?.stripe_customer_id && <ManageBillingButton />}
          </div>
        </div>

        {tier !== 'free' && (
          <p className="tiny muted" style={{ marginTop: '1rem' }}>
            Cancelling in the Stripe portal returns you to the free tier at the end of the billing
            period.
          </p>
        )}
      </Card>

      <Card title="Password">
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
