import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/supabase/server';
import { PortalShell } from '@/components/layout/PortalShell';
import type { Profile } from '@/lib/types';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSessionProfile();

  // Middleware already guards these routes; this is the belt to its braces
  // (and keeps `user` non-null for TypeScript).
  if (!user) redirect('/login');

  return (
    <PortalShell profile={profile as Profile | null} email={user.email ?? ''}>
      {children}
    </PortalShell>
  );
}
