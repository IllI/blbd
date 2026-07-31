import Link from 'next/link';
import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <div className="stack">
      <div>
        <h1 style={{ fontSize: '1.375rem' }}>Reset your password</h1>
        <p className="small muted">We&apos;ll email you a link to set a new one.</p>
      </div>

      <ForgotPasswordForm />

      <p className="auth-footer">
        <Link href="/login">← Back to log in</Link>
      </p>
    </div>
  );
}
