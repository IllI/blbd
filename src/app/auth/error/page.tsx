import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign-in problem' };

const FRIENDLY: Record<string, string> = {
  missing_code: 'That link was missing its sign-in code. It may have been trimmed by an email client.',
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const reason = (await searchParams).reason ?? '';
  const message =
    FRIENDLY[reason] ?? 'That sign-in link is invalid or has already been used. Links expire after a short while.';

  return (
    <div className="status-page">
      <div className="status-page__inner stack">
        <div className="status-page__code" aria-hidden="true">
          ✦
        </div>
        <h1>We couldn&apos;t sign you in</h1>
        <p className="muted">{message}</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link className="btn" href="/login">
            Back to log in
          </Link>
          <Link className="btn btn--secondary" href="/forgot-password">
            Send a new link
          </Link>
        </div>
      </div>
    </div>
  );
}
