import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { ProfileEditor } from '@/components/profile/ProfileEditor';
import { Alert } from '@/components/ui/Alert';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Your profile' };

export default async function ProfilePage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect('/login');

  if (!profile) {
    return (
      <Alert tone="error">
        We couldn&apos;t find your profile row. This usually means the{' '}
        <code>on_auth_user_created</code> trigger didn&apos;t run — check the Supabase SQL migration.
      </Alert>
    );
  }

  return (
    <div className="stack-lg">
      <header className="page-header">
        <h1>Your profile</h1>
        <p>This is what other members see. Share as much or as little as you like.</p>
      </header>

      <ProfileEditor profile={profile as Profile} />
    </div>
  );
}
