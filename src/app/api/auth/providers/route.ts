import { NextResponse } from 'next/server';
import { socialReadiness } from '@/lib/social-auth';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (request.headers.get('origin') === 'https://blbd.webflow.io') headers['Access-Control-Allow-Origin'] = 'https://blbd.webflow.io';
  try { return NextResponse.json({ providers: await socialReadiness() }, { headers }); }
  catch { return NextResponse.json({ error: 'Social sign-in setup could not be verified.', providers: { google: false, yahoo: false } }, { status: 503, headers }); }
}
