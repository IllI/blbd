import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getSessionProfile } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/Card';
import { TierBadge } from '@/components/ui/Badge';
import { goalSlots, tierConfig } from '@/lib/tiers';
import { displayNameOf, formatRelative } from '@/lib/utils';
import { SITE_URL } from '@/lib/env';
import type { BlogComment, Goal, Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const [{ data: goals }, { data: comments }] = await Promise.all([
    supabase.from('goals').select('*').eq('user_id', user.id).order('position'),
    supabase
      .from('blog_comments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const typedProfile = profile as Profile | null;
  const allGoals = (goals ?? []) as Goal[];
  const tier = typedProfile?.membership_tier ?? 'free';
  const slots = goalSlots(tier);

  const living = allGoals.filter((goal) => goal.category === 'living');
  const dying = allGoals.filter((goal) => goal.category === 'dying');
  const done = allGoals.filter((goal) => goal.is_completed).length;

  return (
    <div className="stack-lg">
      <header className="page-header">
        <h1>Hello, {displayNameOf(typedProfile)}</h1>
        <p>
          {allGoals.length === 0
            ? 'Nothing on the board yet. The first goal is the hardest one to write down.'
            : `${done} of ${allGoals.length} goals complete.`}
        </p>
      </header>

      <div className="grid grid--3">
        <div className="stat">
          <div className="stat__label">Living goals</div>
          <div className="stat__value">
            {living.length}
            <span className="muted" style={{ fontSize: '1rem' }}>
              /{slots}
            </span>
          </div>
          <div className="stat__hint">{living.filter((g) => g.is_completed).length} complete</div>
        </div>

        <div className="stat">
          <div className="stat__label">Dying goals</div>
          <div className="stat__value">
            {dying.length}
            <span className="muted" style={{ fontSize: '1rem' }}>
              /{slots}
            </span>
          </div>
          <div className="stat__hint">{dying.filter((g) => g.is_completed).length} complete</div>
        </div>

        <div className="stat">
          <div className="stat__label">Membership</div>
          <div className="stat__value" style={{ fontSize: '1.25rem', paddingTop: '0.3rem' }}>
            <TierBadge tier={tier} />
          </div>
          <div className="stat__hint">{tierConfig(tier).tagline}</div>
        </div>
      </div>

      <div className="grid grid--2">
        <Card
          title="Your goals"
          action={
            <Link className="btn btn--secondary btn--sm" href="/goals">
              Open board
            </Link>
          }
        >
          {allGoals.length === 0 ? (
            <EmptyState
              title="Start with one"
              action={
                <Link className="btn" href="/goals">
                  Add your first goal
                </Link>
              }
            >
              Five things that would make this life better. Five that would make the ending better.
            </EmptyState>
          ) : (
            <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {allGoals.slice(0, 6).map((goal) => (
                <li key={goal.id} className="row small">
                  <span aria-hidden="true">{goal.category === 'living' ? '☀' : '☾'}</span>
                  <span
                    style={{
                      textDecoration: goal.is_completed ? 'line-through' : undefined,
                      color: goal.is_completed ? 'var(--color-muted)' : undefined,
                    }}
                  >
                    {goal.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Your comments"
          action={
            <Link className="btn btn--secondary btn--sm" href={`${SITE_URL}/blog`}>
              Read the blog
            </Link>
          }
        >
          {!comments || comments.length === 0 ? (
            <EmptyState title="No comments yet">
              Join a conversation on the blog and it&apos;ll show up here.
            </EmptyState>
          ) : (
            <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {(comments as BlogComment[]).map((comment) => (
                <li key={comment.id} className="small">
                  <Link href={`${SITE_URL}/blog/${comment.post_slug}`}>{comment.post_slug}</Link>
                  <div className="muted tiny">{formatRelative(comment.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {tier === 'free' && (
        <Card title="Unlock the rest">
          <p className="small muted">
            Supporter opens all ten goal slots, blog comments, and the member directory — $
            {tierConfig('supporter').price}/month.
          </p>
          <Link className="btn" href="/checkout">
            See the tiers
          </Link>
        </Card>
      )}
    </div>
  );
}
