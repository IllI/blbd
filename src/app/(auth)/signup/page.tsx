import Link from 'next/link';
import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth/SignupForm';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { safeNext } from '@/lib/redirects';

export const metadata: Metadata = { title: 'Join BLBD' };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: '1.375rem' }}>Join the community</h1>
        <p className="small muted">
          Free to start. Set your first goals for better living and better dying.
        </p>
      </div>

      <SignupForm next={next} />

      <OAuthButtons next={next} />

      <p className="auth-footer">
        Already a member? <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
      </p>
    </div>
  );
}
