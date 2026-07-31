import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, getSessionProfile } from '@/lib/supabase/server';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { GoalColumn } from '@/components/goals/GoalColumn';
import { displayNameOf, formatDate, safeExternalUrl } from '@/lib/utils';
import type { Goal, GoalCategory, Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Member profile' };

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { user } = await getSessionProfile();

  // RLS already hides non-public profiles from other members, so a miss here
  // is indistinguishable from "doesn't exist" — which is the point.
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();

  const profile = data as Profile;
  const isSelf = user?.id === profile.id;
  const name = displayNameOf(profile);
  const website = safeExternalUrl(profile.website);

  const goalsVisible = isSelf || (profile.is_public && profile.show_goals_publicly);

  const { data: goalRows } = goalsVisible
    ? await supabase.from('goals').select('*').eq('user_id', profile.id).order('position')
    : { data: [] };

  const goals = (goalRows ?? []) as Goal[];

  return (
    <div className="stack-lg">
      <Card>
        <div className="profile-hero">
          <Avatar name={name} url={profile.avatar_url} size={88} />

          <div className="profile-hero__meta">
            <div className="profile-hero__name">
              <h1>{name}</h1>
              <TierBadge tier={profile.membership_tier} />
            </div>

            {profile.bio && <p className="profile-hero__bio">{profile.bio}</p>}

            <div className="profile-hero__facts">
              {profile.location && <span>◎ {profile.location}</span>}
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer nofollow">
                  ↗ {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
              <span>Member since {formatDate(profile.created_at)}</span>
            </div>
          </div>

          {isSelf && (
            <Link className="btn btn--secondary btn--sm" href="/profile">
              Edit
            </Link>
          )}
        </div>
      </Card>

      {goalsVisible ? (
        <>
          <div className="divider" aria-hidden="true">
            ✹ ✦ ✹
          </div>
          <div className="goals-board">
            {(['living', 'dying'] as GoalCategory[]).map((category) => (
              <GoalColumn
                key={category}
                category={category}
                goals={goals.filter((goal) => goal.category === category)}
                unlockedSlots={5}
                readOnly
              />
            ))}
          </div>
        </>
      ) : (
        <Card>
          <p className="small muted">{name} keeps their goals private.</p>
        </Card>
      )}
    </div>
  );
}
