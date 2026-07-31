'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FACEBOOK_OAUTH_ENABLED, GOOGLE_OAUTH_ENABLED } from '@/lib/env';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

type Provider = 'google' | 'facebook';

const LABELS: Record<Provider, string> = {
  google: 'Continue with Google',
  facebook: 'Continue with Facebook',
};

/**
 * Social sign-in. Each provider renders only when its flag is on, because a
 * button for a provider that isn't configured in Supabase fails with an
 * opaque "provider is not enabled" error.
 */
export function OAuthButtons({ next }: { next?: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const providers: Provider[] = [
    ...(GOOGLE_OAUTH_ENABLED ? (['google'] as const) : []),
    ...(FACEBOOK_OAUTH_ENABLED ? (['facebook'] as const) : []),
  ];

  if (providers.length === 0) return null;

  async function signIn(provider: Provider) {
    setPending(provider);
    setError(null);

    const callback = new URL('/auth/callback', window.location.origin);
    if (next) callback.searchParams.set('next', next);

    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });

    if (oauthError) {
      setError(oauthError.message);
      setPending(null);
    }
    // On success the browser navigates away; leave the button loading.
  }

  return (
    <>
      <div className="or-rule">or</div>
      <div className="stack-sm">
        {providers.map((provider) => (
          <Button
            key={provider}
            variant="secondary"
            block
            loading={pending === provider}
            disabled={pending !== null}
            onClick={() => signIn(provider)}
          >
            <ProviderIcon provider={provider} />
            {LABELS[provider]}
          </Button>
        ))}
      </div>
      {error && <p className="field__error">{error}</p>}
    </>
  );
}

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === 'google') {
    return (
      <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
        />
        <path
          fill="#34A853"
          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"
        />
        <path
          fill="#EA4335"
          d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
        />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"
      />
    </svg>
  );
}
