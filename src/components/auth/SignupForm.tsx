'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';

const MIN_PASSWORD_LENGTH = 8;

export function SignupForm({ next = '/dashboard' }: { next?: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);

    // Email confirmation uses the implicit flow (token in URL fragment), which
    // only /auth/confirm (a client page) can consume — not the server route.
    const callback = new URL('/auth/confirm', window.location.origin);
    callback.searchParams.set('next', next);

    const { data, error: signUpError } = await createClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Picked up by the handle_new_user() trigger to seed profiles.display_name.
        data: { display_name: displayName.trim() },
        emailRedirectTo: callback.toString(),
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // With email confirmation on, session is null and the user must click the
    // link. With it off, Supabase returns a session and we can go straight in.
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="stack">
        <Alert tone="success">
          Check <strong>{email}</strong> for a confirmation link. Once you click it you&apos;ll be
          taken to your dashboard.
        </Alert>
        <p className="small muted">
          Nothing arrived? Look in spam, or{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSent(false)}>
            try a different email
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      {error && <Alert tone="error">{error}</Alert>}

      <Input
        label="Name"
        name="displayName"
        autoComplete="name"
        required
        placeholder="How should we greet you?"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Button type="submit" block loading={loading}>
        Create account
      </Button>
    </form>
  );
}
