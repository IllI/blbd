import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requirePublicSupabase } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Supabase client for the comment widget running inside a cross-site iframe.
 *
 * Cookies are the wrong storage here: from `blbd.life`, a cookie set by
 * `app.blbd.life` is a third-party cookie and Safari/Firefox drop it outright.
 * localStorage survives, and under Chrome/Safari storage partitioning it is
 * scoped to the (top-level site, embed origin) pair — which is exactly the
 * behaviour we want, as long as the login also happens *inside* the iframe.
 *
 * That is why the embed carries its own inline sign-in form instead of
 * delegating to the portal's login page in a popup: a session established at
 * `app.blbd.life` as a top-level page lands in a different storage partition
 * and would be invisible in here.
 */
let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createEmbedClient() {
  if (cached) return cached;

  const { url, anonKey } = requirePublicSupabase();

  cached = createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // No OAuth redirects happen inside the frame.
      detectSessionInUrl: false,
      storageKey: 'blbd-embed-auth',
    },
  });

  return cached;
}
