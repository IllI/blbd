import { SITE_URL } from '@/lib/env';

/**
 * Origins allowed to call our API cross-site.
 *
 * The Webflow site is reachable from several hostnames during its life:
 * the custom domain, the `*.webflow.io` staging domain (which is where it
 * actually lives until blbd.life's DNS is moved off GoDaddy), and any
 * subdomain of blbd.life. A single hardcoded origin would break the
 * newsletter form on staging.
 */
const STATIC_ALLOWED = new Set(
  [SITE_URL, 'https://blbd.life', 'https://www.blbd.life'].map((o) => o.replace(/\/$/, '')),
);

function isAllowed(origin: string): boolean {
  if (STATIC_ALLOWED.has(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== 'https:') return false;
    return hostname.endsWith('.blbd.life') || hostname.endsWith('.webflow.io');
  } catch {
    return false;
  }
}

/**
 * CORS headers echoing the caller's origin when permitted. Returns no ACAO
 * header at all for disallowed origins, which is what makes the browser block
 * the response.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (origin && isAllowed(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/** Standard preflight response. */
export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
