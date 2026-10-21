import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createBearerClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';
import { betaIsIsolated } from './environment';
import { isBetaWebflowRequest } from './transport';

export class AdminError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function requireAdmin(request?: Request) {
  if (!betaIsIsolated()) throw new AdminError('Beta admin tools require an isolated beta Supabase project. Production is protected.', 503);
  const authorization = request?.headers.get('authorization');
  let db;
  let token: string | undefined;
  if (authorization !== null && authorization !== undefined) {
    // A bad bearer MUST NOT fall back to a privileged browser cookie.
    if (!request || !isBetaWebflowRequest(request)) throw new AdminError('Use the admin portal to make changes.', 403);
    const match = /^Bearer ([^\s,]+)$/i.exec(authorization);
    if (!match) throw new AdminError('Sign in to continue.', 401);
    token = match[1];
    db = createBearerClient<Database>(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  } else {
    // Preserve first-party cookie sessions and CSRF protection. Cross-origin
    // reads also require bearer; never expose admin data through cookie CORS.
    if (request) {
      const origin = request.headers.get('origin');
      if ((origin && origin !== new URL(request.url).origin)
        || request.headers.get('sec-fetch-site') === 'cross-site'
        || (request.method !== 'GET' && !origin)) {
        throw new AdminError('Use the admin portal to make changes.', 403);
      }
    }
    db = await createClient();
  }
  const { data: { user }, error } = await db.auth.getUser(token);
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
