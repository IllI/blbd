import Link from 'next/link';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { safeNext } from '@/lib/redirects';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);

  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: '1.375rem' }}>Welcome back</h1>
        <p className="small muted">Pick up where you left off.</p>
      </div>

      <LoginForm next={next} />

      <OAuthButtons next={next} />

      <p className="auth-footer">
        <Link href="/forgot-password">Forgot your password?</Link>
        <br />
        New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </div>
  );
}
