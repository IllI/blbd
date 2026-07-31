import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { APP_URL, SITE_URL, SUPABASE_URL } from '@/lib/env';

export const metadata: Metadata = {
  title: 'BLBD membership service',
  robots: { index: false, follow: false },
};

/**
 * The portal has no landing page — blbd.life (Webflow) is the public face of
 * BLBD. Members are sent to their dashboard; everyone else gets this small
 * status card.
 *
 * This is deliberately a diagnostics page, not marketing: it exists so that
 * hitting the service root tells you whether the deployment is healthy and
 * what to paste into Webflow, instead of bouncing to another domain.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/dashboard');

  const checks = [
    { label: 'Supabase', ok: Boolean(SUPABASE_URL), detail: SUPABASE_URL || 'not configured' },
    { label: 'Stripe', ok: !process.env.STRIPE_SECRET_KEY?.includes('placeholder'), detail: 'live keys' },
    { label: 'Resend', ok: !process.env.RESEND_API_KEY?.includes('placeholder'), detail: 'live key' },
    { label: 'Webflow CMS', ok: Boolean(process.env.WEBFLOW_API_TOKEN), detail: 'blog sync' },
  ];

  const snippet = `<script defer src="${APP_URL}/v2/blbd.js"
  data-supabase-url="${SUPABASE_URL}"
  data-supabase-key="YOUR_ANON_KEY"
  data-app-url="${APP_URL}"></script>`;

  return (
    <main className="status-page">
      <div className="status-page__inner stack" style={{ maxWidth: 620, textAlign: 'left' }}>
        <div>
          <div className="status-page__code" aria-hidden="true">
            ✹ ✦ ✹
          </div>
          <h1 style={{ fontSize: '1.375rem' }}>BLBD membership service</h1>
          <p className="muted small">
            This is the backend for <a href={SITE_URL}>blbd.life</a> — auth, member data, payments,
            and the Webflow script. There is no site here; the public site lives in Webflow.
          </p>
        </div>

        <section className="card">
          <h2 style={{ fontSize: '1rem' }}>Service status</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {checks.map((check) => (
              <li key={check.label} className="row-between small" style={{ padding: '0.35rem 0' }}>
                <span>{check.label}</span>
                <span className={check.ok ? 'strong' : 'muted'}>
                  {check.ok ? '● connected' : '○ not configured'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 style={{ fontSize: '1rem' }}>Webflow install</h2>
          <p className="small muted">
            Site settings → Custom code → <strong>Footer code</strong>, then publish.
          </p>
          <pre
            style={{
              margin: 0,
              padding: '0.75rem',
              background: 'var(--color-bg-light)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              overflowX: 'auto',
            }}
          >
            <code>{snippet}</code>
          </pre>
        </section>

        <div className="row wrap">
          <a className="btn btn--secondary" href="/login">
            Member log in
          </a>
          <a className="btn btn--secondary" href={`${APP_URL}/blbd.js`}>
            View blbd.js
          </a>
        </div>
      </div>
    </main>
  );
}
