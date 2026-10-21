import 'server-only';
import { NextResponse } from 'next/server';
import { betaIsIsolated } from './environment';

// Deliberately NOT the public API's *.webflow.io CORS policy. This opt-in
// transport is only for our isolated beta site, never production or previews
// on arbitrary designer domains. Origins are not identity; requireAdmin still
// verifies the bearer with Supabase and reads the current database role.
export const BETA_WEBFLOW_ORIGIN = 'https://blbd.webflow.io';
export function isBetaWebflowRequest(request: Request): boolean {
  return betaIsIsolated()
    && process.env.BLBD_WEBFLOW_ADMIN_ORIGIN === BETA_WEBFLOW_ORIGIN
    && request.headers.get('origin') === BETA_WEBFLOW_ORIGIN;
}

export function adminCors(request: Request, response: Response): Response {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.append('Vary', 'Origin');
  if (isBetaWebflowRequest(request)) {
    response.headers.set('Access-Control-Allow-Origin', BETA_WEBFLOW_ORIGIN);
    // Never Access-Control-Allow-Credentials: Webflow sends bearer only.
  }
  return response;
}

export function adminPreflight(request: Request, methods: string[]): Response {
  const method = request.headers.get('access-control-request-method') ?? '';
  const headers = (request.headers.get('access-control-request-headers') ?? '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!isBetaWebflowRequest(request) || !methods.includes(method)
    || !headers.includes('authorization')
    || headers.some(value => !['authorization', 'content-type'].includes(value))) {
    return new NextResponse(null, { status: 403, headers: { 'Cache-Control': 'no-store', Vary: 'Origin' } });
  }
  const response = adminCors(request, new NextResponse(null, { status: 204 }));
  response.headers.set('Access-Control-Allow-Methods', methods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.headers.set('Access-Control-Max-Age', '300');
  response.headers.append('Vary', 'Access-Control-Request-Method, Access-Control-Request-Headers');
  return response;
}

/** Apply identical CORS/no-store headers to success AND handled error responses. */
export function adminRoute(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => adminCors(request, await handler(request));
}
