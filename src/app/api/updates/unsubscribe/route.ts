import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/admin/validation';
import { betaIsIsolated } from '@/lib/admin/environment';
// GET is intentionally non-mutating: email-link scanners must not opt people out.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  const url = new URL('/updates/unsubscribe', request.url);
  if (isUuid(token)) url.searchParams.set('token', token);
  return NextResponse.redirect(url);
}
// RFC 8058 one-click POST and explicit confirmation form.
export async function POST(request: Request) {
  if (!betaIsIsolated()) return NextResponse.json({ error: 'Beta email preferences are not configured.' }, { status: 503 });
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!isUuid(token)) return NextResponse.json({ error: 'Invalid unsubscribe link.' }, { status: 400 });
  const { error } = await createAdminClient().rpc('unsubscribe_blbd_updates', { p_token: token });
  if (error) return NextResponse.json({ error: 'Could not save your preference. Try again.' }, { status: 500 });
  if (request.headers.get('accept')?.includes('text/html')) return NextResponse.redirect(new URL('/updates/unsubscribe?done=1', url), 303);
  return NextResponse.json({ success: true });
}
