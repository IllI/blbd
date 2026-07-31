import type { NextConfig } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://blbd.life';

// Origins allowed to frame /embed/*. Webflow serves the published site from
// the custom domain and from the *.webflow.io staging domain, so both need
// to be permitted while the site is still in staging.
const FRAME_ANCESTORS = [
  "'self'",
  SITE_URL,
  'https://*.blbd.life',
  'https://*.webflow.io',
].join(' ');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage public bucket (avatars)
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },

  async headers() {
    return [
      {
        // Frameable widgets. X-Frame-Options cannot express an allowlist, so
        // it is deliberately omitted here — CSP frame-ancestors is the control.
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors ${FRAME_ANCESTORS}` },
        ],
      },
      {
        // The Webflow membership SDK — unversioned "edge" copy. This is
        // whatever is currently on the branch: fine for our own testing on
        // blbd-2, wrong for a real Webflow production install (see /v1/
        // below). Short cache so fixes reach testers quickly.
        source: '/blbd.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=300, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        // Versioned SDK releases. Each /vN/blbd.js is a deliberately frozen
        // copy (see scripts/release-sdk.mjs) — once cut, its content never
        // changes, so it is safe to cache hard. A real Webflow production
        // install should always point at one of these, never the bare
        // /blbd.js above, so a work-in-progress edit can never reach the live
        // site without an explicit release step.
        source: '/v:version(\\d+)/blbd.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        // Everything else must never be framed.
        source: '/((?!embed|blbd\\.js|v\\d+/blbd\\.js).*)',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
      // NOTE: API CORS is deliberately NOT set here. A static header can only
      // name one origin, and the Webflow site is reachable from the custom
      // domain *and* its *.webflow.io staging host. The routes that accept
      // cross-site calls echo the caller's origin instead — see lib/cors.ts.
    ];
  },
};

export default nextConfig;
