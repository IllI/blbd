import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { betaIsIsolated } from './environment';

export class AdminError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function requireAdmin(request?: Request) {
  if (!betaIsIsolated()) throw new AdminError('Beta admin tools require an isolated beta Supabase project. Production is protected.', 503);
  // Admin UI uses same-origin cookie sessions. Reject cross-site
  // mutation attempts; no CORS endpoint or client-side email allowlist.
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      throw new AdminError('Use the admin portal to make changes.', 403);
    }
  }
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new AdminError('Sign in to continue.', 401);
  if (!user.email_confirmed_at || !user.email) throw new AdminError('Verify your email first.', 403);
  const { data: profile, error: profileError } = await db.from('profiles').select('is_admin').eq('id', user.id).single();
  if (profileError || !profile?.is_admin) throw new AdminError('Admins only.', 403);
  return { user, db };
}
export function adminFailure(error: unknown) {
  if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  // Do not log message bodies, audience addresses, tokens, or provider payloads.
  console.error('[admin]', error instanceof Error ? error.name : 'Request failed');
  return NextResponse.json({ error: 'Request failed. Check configuration or try again.' }, { status: 500 });
}
