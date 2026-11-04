import { NextResponse } from 'next/server';
import { requireAdmin, adminFailure } from '@/lib/admin/auth';
// No legacy endpoint may bypass audience review, opt-outs, or the send switch.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json({ error: 'Use Admin → Updates to review, test, and send a campaign.' }, { status: 410 });
  } catch (error) { return adminFailure(error); }
}
