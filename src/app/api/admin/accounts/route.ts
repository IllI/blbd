import { NextResponse } from 'next/server';
import { requireAdmin, adminFailure, AdminError } from '@/lib/admin/auth';
import { isUuid } from '@/lib/admin/validation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const page = Math.max(1, Math.min(100000, Math.floor(Number(new URL(request.url).searchParams.get('page')) || 1)));
    const db = createAdminClient();
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 50 });
    if (error) throw error;
    const ids = data.users.map(u => u.id);
    const { data: profiles, error: profileError } = ids.length
      ? await db.from('profiles').select('id, display_name, is_admin, membership_tier').in('id', ids)
      : { data: [], error: null };
    if (profileError) throw profileError;
    const byId = new Map(profiles?.map(p => [p.id, p]));
    return NextResponse.json({ page, hasMore: !!data.nextPage, accounts: data.users.map(u => ({
      id: u.id, email: u.email ?? '', display_name: byId.get(u.id)?.display_name ?? null,
      is_admin: byId.get(u.id)?.is_admin ?? false, membership_tier: byId.get(u.id)?.membership_tier ?? 'free',
      verified: !!u.email_confirmed_at, created_at: u.created_at,
    })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return adminFailure(error); }
}
export async function PATCH(request: Request) {
  try {
    const { user } = await requireAdmin(request);
    const input = await request.json();
    if (!isUuid(input.id) || typeof input.display_name !== 'string' || input.display_name.length > 100 || typeof input.is_admin !== 'boolean') throw new AdminError('Invalid account details.');
    const { error } = await createAdminClient().rpc('admin_set_account', {
      p_actor: user.id, p_user: input.id, p_name: input.display_name, p_admin: input.is_admin,
    });
    if (error) {
      if (error.message.includes('last verified admin') || error.message.includes('Verify the user email')) throw new AdminError(error.message, 409);
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) { return adminFailure(error); }
}
