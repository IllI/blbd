'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="status-page">
      <div className="status-page__inner stack">
        <div className="status-page__code" aria-hidden="true">
          ✦
        </div>
        <h1>Something broke</h1>
        <p className="muted">
          We hit an unexpected error. Try again — if it keeps happening, let us know.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={reset}>
            Try again
          </button>
          <a className="btn btn--secondary" href="/dashboard">
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
