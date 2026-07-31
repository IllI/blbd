'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { safeNext } from '@/lib/redirects';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Landing page for email-confirmation and password-reset links.
 *
 * Supabase's mailer uses the implicit flow, which returns the session in the
 * URL *fragment* (`#access_token=…`). Fragments never reach the server, so a
 * route handler can't process them — this client page does. The browser
 * Supabase client parses the fragment on creation and writes the session to
 * cookies; we then forward to wherever the link intended (`?next=`), or the
 * dashboard.
 *
 * OAuth still uses /auth/callback (server, PKCE `?code=`); this page also
 * exchanges a `?code=` as a fallback so a single redirect target works for
 * every flow.
 */
function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const next = safeNext(params.get('next'));
    let done = false;

    const go = () => {
      if (done) return;
      done = true;
      router.replace(next);
      router.refresh();
    };

    // Fires once the fragment has been consumed and the session stored.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go();
    });

    (async () => {
      // Already have a session (fragment parsed synchronously on init)?
      const { data: initial } = await supabase.auth.getSession();
      if (initial.session) return go();

      // Fallback: a PKCE code in the query string.
      const code = params.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) setError(exchangeError.message);
        else go();
        return;
      }

      // Give detectSessionInUrl a moment, then give up.
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        if (data.session) go();
        else if (!done) setError('This link is invalid or has already been used. Links expire after a short while.');
      }, 1800);
    })();

    return () => sub.subscription.unsubscribe();
  }, [router, params]);

  if (error) {
    return (
      <div className="status-page">
        <div className="status-page__inner stack">
          <div className="status-page__code" aria-hidden="true">
            ✦
          </div>
          <h1>Couldn&apos;t confirm that link</h1>
          <p className="muted">{error}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link className="btn" href="/login">
              Go to log in
            </Link>
            <Link className="btn btn--secondary" href="/forgot-password">
              Send a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="status-page">
      <div className="status-page__inner stack" style={{ alignItems: 'center' }}>
        <Spinner dark label="Signing you in…" />
        <p className="muted">Signing you in…</p>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
