import type { Metadata } from 'next';
import { UnsubscribeForm } from '@/components/newsletter/UnsubscribeForm';

export const metadata: Metadata = { title: 'Unsubscribe' };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="status-page">
      <div className="status-page__inner stack">
        <div className="status-page__code" aria-hidden="true">
          ✦
        </div>
        {params.done ? (
          <>
            <h1>You&apos;re unsubscribed</h1>
            <p className="muted">You won&apos;t receive any more BLBD newsletters. Sorry to see you go.</p>
          </>
        ) : (
          <>
            <h1>Unsubscribe</h1>
            <p className="muted">Enter the email address you subscribed with.</p>
            <UnsubscribeForm />
          </>
        )}
      </div>
    </div>
  );
}
