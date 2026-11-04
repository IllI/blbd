import { NextResponse } from 'next/server';
import { APP_URL } from '@/lib/env';
import { safeNext } from '@/lib/redirects';
import { createClient } from '@/lib/supabase/server';
import { betaIsIsolated } from '@/lib/admin/environment';
import { SOCIAL_PROVIDERS, socialReadiness, type SocialProvider } from '@/lib/social-auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
/** Top-level navigation from Webflow establishes first-party PKCE cookies on
 * the existing portal host. Tokens are never passed via query strings, copied
 * between origins, or minted by custom application code. Supabase owns OAuth. */
export async function GET(request: Request) {
  if (!betaIsIsolated()) return NextResponse.json({ error: 'Beta social sign-in is unavailable here.' }, { status: 503 });
  const url = new URL(request.url), provider = url.searchParams.get('provider');
  if (provider !== 'google' && provider !== 'yahoo') return NextResponse.json({ error: 'Choose Google or Yahoo.' }, { status: 400 });
  const next = safeNext(url.searchParams.get('next'));
  const canonical = new URL('/auth/social', APP_URL);
  if (canonical.origin !== url.origin) {
    canonical.searchParams.set('provider', provider); canonical.searchParams.set('next', next);
    return NextResponse.redirect(canonical);
  }
  const fail = (reason: string) => NextResponse.redirect(new URL('/auth/error?reason=' + reason, canonical));
  if (!rateLimit(`social:${clientIp(request)}`, 20, 60_000)) return fail('social_rate_limit');
  try {
    const readiness = await socialReadiness();
    if (!readiness[provider as SocialProvider]) return fail('social_setup_required');
    const callback = new URL('/auth/callback', canonical);
    callback.searchParams.set('next', next);
    const db = await createClient();
    const { data, error } = await db.auth.signInWithOAuth({
      provider: SOCIAL_PROVIDERS[provider as SocialProvider],
      options: { redirectTo: callback.toString(), skipBrowserRedirect: true },
    });
    if (error || !data.url) return fail('social_sign_in_failed');
    // Only follow our own Auth server's authorize URL, never arbitrary URLs.
    const authorize = new URL(data.url);
    if (authorize.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || authorize.pathname !== '/auth/v1/authorize') return fail('social_sign_in_failed');
    const response = NextResponse.redirect(authorize);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch { return fail('social_sign_in_failed'); }
}
