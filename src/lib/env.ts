/**
 * Environment access.
 *
 * IMPORTANT — client-visible vars must be referenced as *literal*
 * `process.env.NEXT_PUBLIC_FOO` member expressions. Next.js inlines them by
 * static text substitution during the build; a dynamic lookup such as
 * `process.env[name]` is never substituted and evaluates to `undefined` in
 * the browser bundle. That is why the constants below are spelled out one by
 * one instead of going through a helper.
 *
 * `.trim()` guards against trailing whitespace/newlines picked up when a
 * value is set through a shell pipe.
 */

const clean = (value: string | undefined): string => value?.trim() ?? '';

// --- Client-safe (inlined into the browser bundle) ---
export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const APP_URL = clean(process.env.NEXT_PUBLIC_APP_URL) || 'http://localhost:3000';
export const SITE_URL = clean(process.env.NEXT_PUBLIC_SITE_URL) || 'https://blbd.life';
export const STRIPE_PUBLISHABLE_KEY = clean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export const GOOGLE_OAUTH_ENABLED = clean(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH) === 'true';
export const FACEBOOK_OAUTH_ENABLED =
  clean(process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_OAUTH) === 'true';

/** Throws with a readable message if a client-side Supabase var is missing. */
export function requirePublicSupabase(): { url: string; anonKey: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then rebuild — these are inlined at build time, so a redeploy is required after changing them.',
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

/**
 * Server-only env access. Safe to use a dynamic key here because this runs in
 * Node, where `process.env` is the real object.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.local.example to .env.local (or set it in Vercel → Settings → Environment Variables).`,
    );
  }
  return value;
}
