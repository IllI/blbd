import { createBrowserClient } from '@supabase/ssr';
import { requirePublicSupabase } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Browser client for portal pages. Backed by cookies so the session is
 * shared with server components and middleware.
 *
 * The comment embed does NOT use this — see lib/supabase/embed.ts.
 */
export function createClient() {
  const { url, anonKey } = requirePublicSupabase();
  return createBrowserClient<Database>(url, anonKey);
}
