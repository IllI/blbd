import { NextResponse } from 'next/server';
import { requireAdmin, adminFailure, AdminError } from '@/lib/admin/auth';
import { isUuid, parseAudience, parseMessage } from '@/lib/admin/validation';
import { mailConfiguration, sendCampaignBatch, testCampaign } from '@/lib/admin/mail';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminRoute, adminPreflight } from '@/lib/admin/transport';

export const runtime = 'nodejs';
export const maxDuration = 60;

export function OPTIONS(request: Request) { return adminPreflight(request, ['GET', 'POST']); }
export const GET = adminRoute(async (request: Request) => {
  try {
    await requireAdmin(request);
    const db = createAdminClient();
    const params = new URL(request.url).searchParams;
    const q = (params.get('q') ?? '').trim().slice(0, 100);
    const offset = Math.max(0, Math.floor(Number(params.get('offset')) || 0));
    let query = db.rpc('admin_mail_contacts', {}).order('email').range(offset, offset + 99);
    if (q) query = query.ilike('email', `%${q.replace(/[%_]/g, '')}%`);
    const [contacts, groups, campaigns] = await Promise.all([
      query, db.from('mail_groups').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('mail_campaigns').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    if (contacts.error || groups.error || campaigns.error) throw contacts.error ?? groups.error ?? campaigns.error;
    const enriched = await Promise.all((campaigns.data ?? []).map(async campaign => {
      const counts = await Promise.all((['accepted', 'pending', 'skipped'] as const).map(status => db.from('mail_recipients').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', status)));
      if (counts.some(c => c.error)) throw new Error('Could not read delivery counts');
      return { ...campaign, accepted: counts[0].count, pending: counts[1].count, skipped: counts[2].count };
    }));
    return NextResponse.json({ contacts: contacts.data, groups: groups.data, campaigns: enriched, mail: mailConfiguration() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return adminFailure(error); }
});
export const POST = adminRoute(async (request: Request) => {
  try {
    const { user } = await requireAdmin(request);
    const input = await request.json();
    const db = createAdminClient();
    if (input.action === 'preview') {
      const audience = parseAudience(input.audience);
      const { count, error } = await db.rpc('admin_mail_audience', { p_audience: audience }, { count: 'exact', head: true });
      if (error) throw error;
      return NextResponse.json({ count });
    }
    if (input.action === 'group') {
      const audience = parseAudience({ kind: 'individuals', emails: input.emails });
      if (audience.kind !== 'individuals' || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 100) throw new AdminError('Name the group and select contacts.');
      const { data: eligible, error } = await db.rpc('admin_mail_audience', { p_audience: audience });
      if (error) throw error;
      if (eligible?.length !== audience.emails.length) throw new AdminError('Groups can contain only eligible existing contacts.');
      const { data: group, error: saveError } = await db.from('mail_groups').insert({ name: input.name.trim(), emails: audience.emails, created_by: user.id }).select('*').single();
      if (saveError) throw saveError;
      const { error: auditError } = await db.from('admin_audit').insert({ actor_id: user.id, action: 'create_group', target_id: group.id, details: { count: group.emails.length } });
      if (auditError) throw auditError;
      return NextResponse.json({ group });
    }
    if (input.action === 'prepare') {
      const message = parseMessage(input);
      const { data: id, error } = await db.rpc('admin_prepare_mail', { p_actor: user.id, p_subject: message.subject, p_body: message.body, p_audience: message.audience });
      if (error) throw error;
      return NextResponse.json({ id });
    }
    if ((input.action === 'test' || input.action === 'send') && isUuid(input.id)) {
      const { data: campaign, error } = await db.from('mail_campaigns').select('*').eq('id', input.id).single();
      if (error || !campaign) throw new AdminError('Campaign not found.', 404);
      if (input.action === 'test') {
        await testCampaign(campaign, user.email!);
        const { error: auditError } = await db.from('admin_audit').insert({ actor_id: user.id, action: 'test_mail', target_id: campaign.id });
        if (auditError) throw auditError;
        return NextResponse.json({ test: true });
      }
      if (input.confirmCount !== campaign.recipient_count) throw new AdminError('Confirm the exact reviewed audience count.');
      return NextResponse.json(await sendCampaignBatch(campaign, user.id));
    }
    throw new AdminError('Unknown action.');
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && /^(Choose|Invalid|Enter|Select)/.test(error.message))) return adminFailure(new AdminError(error.message));
    return adminFailure(error);
  }
});
