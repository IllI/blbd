import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { requireEnv } from '@/lib/env';
import type { Database } from './database.types';

/**
 * Server client for server components, route handlers, and server actions.
 * Must be created per-request — never hoisted to a module-level singleton.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server components cannot set cookies. Middleware refreshes the
            // session on every request, so it is safe to ignore here.
          }
        },
      },
    },
  );
}

/**
 * Resolves the caller from either an `Authorization: Bearer` header or the
 * cookie session, in that order.
 *
 * The Webflow SDK calls our API cross-origin, where cookies are not sent, so
 * it presents the Supabase access token instead. Portal pages on this origin
 * still use cookies. Both paths verify the JWT with Supabase — a token is
 * never trusted on its face.
 */
export async function getRequestUser(request: Request) {
  const header = request.headers.get('authorization');

  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    const bearer = createSupabaseClient<Database>(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await bearer.auth.getUser(token);
    if (data.user) return data.user;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the signed-in user's auth record and profile, or nulls.
 * Uses getUser() (not getSession()) so the JWT is verified server-side.
 */
export async function getSessionProfile() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}
