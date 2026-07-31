import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routes that require a session. Everything else — including `/` (the public
 * landing page) — is open.
 */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/blog',
  '/profile',
  '/goals',
  '/community',
  '/settings',
  '/checkout',
  '/admin',
];

/** Auth pages a signed-in user should be bounced away from. */
const AUTH_PAGES = ['/login', '/signup', '/forgot-password'];

export async function middleware(request: NextRequest) {
  // This response object accumulates refreshed auth cookies and must be the
  // one returned, otherwise the rotated refresh token is dropped.
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without credentials there is no session to refresh; let the page render
  // and surface the misconfiguration there rather than 500-ing every route.
  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(redirect);
  }

  if (user && AUTH_PAGES.includes(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/dashboard';
    redirect.search = '';
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the embed widget. The embed manages
     * its own localStorage session (see lib/supabase/embed.ts) and must never
     * be redirected to /login — it renders inside someone else's page.
     */
    '/((?!_next/static|_next/image|favicon.ico|embed|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
