import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient, getSessionProfile } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { NewsletterComposer } from '@/components/admin/NewsletterComposer';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Newsletter' };

export default async function AdminNewsletterPage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect('/login');

  // 404 rather than 403: non-admins shouldn't learn the page exists.
  if (!(profile as Profile | null)?.is_admin) notFound();

  const supabase = await createClient();
  const [{ count: confirmed }, { count: pending }] = await Promise.all([
    supabase
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('is_confirmed', true)
      .is('unsubscribed_at', null),
    supabase
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('is_confirmed', false),
  ]);

  return (
    <div className="stack-lg">
      <header className="page-header">
        <h1>Newsletter</h1>
        <p>Write it, send yourself a test, then send it to the list.</p>
      </header>

      <div className="grid grid--2">
        <div className="stat">
          <div className="stat__label">Confirmed subscribers</div>
          <div className="stat__value">{confirmed ?? 0}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Awaiting confirmation</div>
          <div className="stat__value">{pending ?? 0}</div>
        </div>
      </div>

      <Card title="Compose">
        <NewsletterComposer recipientCount={confirmed ?? 0} />
      </Card>
    </div>
  );
}
