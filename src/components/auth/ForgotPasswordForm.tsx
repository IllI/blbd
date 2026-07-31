'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Recovery links also use the implicit flow → /auth/confirm handles them.
    const redirectTo = new URL('/auth/confirm', window.location.origin);
    redirectTo.searchParams.set('next', '/settings?reset=1');

    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo.toString(),
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <Alert tone="success">
        If an account exists for <strong>{email}</strong>, a reset link is on its way.
      </Alert>
    );
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      {error && <Alert tone="error">{error}</Alert>}

      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Button type="submit" block loading={loading}>
        Send reset link
      </Button>
    </form>
  );
}
