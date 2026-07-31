import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient, getSessionProfile } from '@/lib/supabase/server';
import { GoalsBoard } from '@/components/goals/GoalsBoard';
import { Alert } from '@/components/ui/Alert';
import type { Goal, Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Goals' };

export default async function GoalsPage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .order('position');

  return (
    <div className="stack-lg">
      <header className="page-header">
        <h1>Your ten</h1>
        <p>
          Five for living well, five for dying well. Drag a card — or use the arrows — to reorder.
          Tick one off when it&apos;s done.
        </p>
      </header>

      {error && <Alert tone="error">Couldn&apos;t load your goals: {error.message}</Alert>}

      <GoalsBoard
        userId={user.id}
        tier={(profile as Profile | null)?.membership_tier ?? 'free'}
        initialGoals={(goals ?? []) as Goal[]}
      />
    </div>
  );
}
