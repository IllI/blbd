import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/env';

export const metadata: Metadata = { title: 'Newsletter' };

const MESSAGES: Record<string, { heading: string; body: string }> = {
  ok: {
    heading: "You're on the list",
    body: 'Thanks for confirming. Look out for the next letter.',
  },
  invalid: {
    heading: 'That link has expired',
    body: 'Confirmation links can only be used once. Sign up again from the site and we’ll send a fresh one.',
  },
  error: {
    heading: 'Something went wrong',
    body: 'We couldn’t confirm your subscription. Please try the link again in a moment.',
  },
};

export default async function NewsletterConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const status = (await searchParams).status ?? 'ok';
  const message = MESSAGES[status] ?? MESSAGES.invalid;

  return (
    <div className="status-page">
      <div className="status-page__inner stack">
        <div className="status-page__code" aria-hidden="true">
          ✦
        </div>
        <h1>{message.heading}</h1>
        <p className="muted">{message.body}</p>
        <div>
          <Link className="btn" href={SITE_URL}>
            Back to blbd.life
          </Link>
        </div>
      </div>
    </div>
  );
}
