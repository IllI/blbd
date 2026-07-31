'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

/**
 * Inline sign-in for the comment iframe.
 *
 * Login must happen *inside* the frame (not via a popup to the portal) so the
 * resulting session lands in the same storage partition the widget reads from
 * — see lib/supabase/embed.ts. Sign-up is intentionally punted to the portal
 * in a new tab, because it needs email confirmation and a fuller flow.
 */
export function EmbedAuth({ supabase }: { supabase: SupabaseClient<Database> }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const [mode, setMode] = useState<'prompt' | 'form'>('prompt');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'That email and password did not match.'
          : signInError.message,
      );
      setLoading(false);
      return;
    }
    // onAuthStateChange in the widget swaps this out for the composer.
  }

  if (mode === 'prompt') {
    return (
      <div className="comment-gate">
        <h3>Join the conversation</h3>
        <p>Log in to comment. New here? Create a free account, then come back.</p>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <Button size="sm" onClick={() => setMode('form')}>
            Log in
          </Button>
          <a
            className="btn btn--secondary btn--sm"
            href={`${appUrl}/signup`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Create account ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="comment-form" onSubmit={signIn}>
      {error && <Alert tone="error">{error}</Alert>}

      <input
        className="input"
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Email"
      />
      <input
        className="input"
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Password"
      />

      <div className="comment-form__actions">
        <a
          className="tiny"
          href={`${appUrl}/forgot-password`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Forgot password?
        </a>
        <div className="row">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('prompt')}>
            Back
          </Button>
          <Button type="submit" size="sm" loading={loading}>
            Log in
          </Button>
        </div>
      </div>
    </form>
  );
}
