import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getSessionProfile } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/Badge';
import { canViewDirectory } from '@/lib/tiers';
import { displayNameOf } from '@/lib/utils';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Community' };

const PAGE_SIZE = 24;

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect('/login');

  const tier = (profile as Profile | null)?.membership_tier ?? 'free';

  if (!canViewDirectory(tier)) {
    return (
      <div className="stack-lg">
        <header className="page-header">
          <h1>Community</h1>
        </header>
        <Card>
          <EmptyState
            title="The directory is for supporters and up"
            action={
              <Link className="btn" href="/checkout">
                See the tiers
              </Link>
            }
          >
            Upgrading opens the member directory, blog comments, and all ten goal slots.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const members = (data ?? []) as Profile[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="stack-lg">
      <header className="page-header">
        <h1>Community</h1>
        <p>{count ?? 0} members have made their profile public.</p>
      </header>

      {members.length === 0 ? (
        <Card>
          <EmptyState title="Nobody here yet">
            Be the first — make your profile public from the profile page.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid--auto">
          {members.map((member) => {
            const name = displayNameOf(member);
            return (
              <Link key={member.id} href={`/profile/${member.id}`} className="member-card">
                <div className="row">
                  <Avatar name={name} url={member.avatar_url} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div className="strong">{name}</div>
                    {member.location && <div className="tiny muted">{member.location}</div>}
                  </div>
                </div>
                {member.bio && <p className="member-card__bio">{member.bio}</p>}
                <TierBadge tier={member.membership_tier} />
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="row" aria-label="Pagination">
          {page > 1 && (
            <Link className="btn btn--secondary btn--sm" href={`/community?page=${page - 1}`}>
              ← Previous
            </Link>
          )}
          <span className="small muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link className="btn btn--secondary btn--sm" href={`/community?page=${page + 1}`}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
