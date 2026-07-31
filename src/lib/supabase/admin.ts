import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only for code paths where there is no user JWT to act on behalf of, or
 * where the write is deliberately privileged: Stripe webhooks, newsletter
 * subscribe/confirm, admin sends. Never import this into a client component
 * — `server-only` turns that into a build error.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
