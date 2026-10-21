import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResend, fromAddress, emailShell, escapeHtml } from '@/lib/resend';
import { AdminError } from './auth';
import type { MailCampaign } from './types';
import { betaIsIsolated } from './environment';

export function mailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const address = process.env.BLBD_MAIL_POSTAL_ADDRESS?.trim();
  const enabled = process.env.BLBD_ADMIN_MAIL_ENABLED === 'true';
  const ready = !!(apiKey && !/placeholder|\.\.\.|your[_-]/i.test(apiKey) && base?.startsWith('https://') && address && /@blbd\.life>/i.test(fromAddress()));
  return { ready, enabled, canSend: ready && enabled && betaIsIsolated() };
}
export function requireMail() {
  if (!mailConfiguration().canSend) throw new AdminError('Mail is disabled. Configure the verified sender, API key, HTTPS app URL, postal address, and BLBD_ADMIN_MAIL_ENABLED first.', 503);
}
function appUrl() { return process.env.NEXT_PUBLIC_APP_URL!.trim().replace(/\/$/, ''); }
function render(campaign: Pick<MailCampaign, 'subject' | 'body'>, token?: string) {
  const url = token ? `${appUrl()}/updates/unsubscribe?token=${token}` : '';
  const content = campaign.body.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`).join('');
  return {
    html: emailShell(`${content}<hr /><p style="font-size:12px;">${escapeHtml(process.env.BLBD_MAIL_POSTAL_ADDRESS!)}${url ? `<br /><a href="${escapeHtml(url)}">Unsubscribe from BLBD updates</a>` : '<br />Test message — not sent to your audience.'}</p>`, campaign.subject),
    text: `${campaign.body}\n\n${process.env.BLBD_MAIL_POSTAL_ADDRESS}${url ? `\nUnsubscribe: ${url}` : '\nTest message — not sent to your audience.'}`,
  };
}
export async function testCampaign(campaign: MailCampaign, email: string) {
  requireMail();
  const { error, data } = await getResend().emails.send({ from: fromAddress(), to: email,
    subject: `[TEST] ${campaign.subject}`, ...render(campaign), replyTo: 'contact@blbd.life' });
  if (error || !data?.id) throw new AdminError('Email provider rejected the test. No audience emails were sent.', 502);
  const db = createAdminClient();
  const { error: saveError } = await db.from('mail_campaigns').update({ tested_at: new Date().toISOString() }).eq('id', campaign.id);
  if (saveError) throw saveError;
}

// A bounded request sends at most 25 individual messages. The UI can resume
// later; it does not leave a serverless request running over the whole list.
export async function sendCampaignBatch(campaign: MailCampaign, actor: string) {
  requireMail();
  if (campaign.status === 'complete') return { complete: true };
  const db = createAdminClient();
  const lease = randomUUID();
  const { data: claimed, error: claimError } = await db.rpc('admin_claim_mail', { p_actor: actor, p_campaign: campaign.id, p_lease: lease });
  if (claimError) throw claimError;
  if (!claimed) throw new AdminError('Send a test first, wait for the current batch, or review an interrupted campaign older than 23 hours.', 409);
  try {
    const { data: pending, error } = await db.from('mail_recipients').select('*').eq('campaign_id', campaign.id).eq('status', 'pending').order('email').limit(25);
    if (error) throw error;
    // Filter just this batch inside SQL; never rely on a 1,000-row REST default
    // when deciding whether a large-list recipient still exists or opted out.
    const { data: contacts, error: contactError } = pending?.length
      ? await db.rpc('admin_mail_audience', { p_audience: { kind: 'individuals', emails: pending.map(r => r.email) } })
      : { data: [], error: null };
    if (contactError) throw contactError;
    const eligible = new Set((contacts ?? []).map(c => c.email));
    const rows = (pending ?? []).filter(r => eligible.has(r.email));
    const skipped = (pending ?? []).filter(r => !eligible.has(r.email));
    if (skipped.length) {
      const { error: skipError } = await db.from('mail_recipients').update({ status: 'skipped' }).eq('campaign_id', campaign.id).in('email', skipped.map(r => r.email));
      if (skipError) throw skipError;
    }
    // Individual idempotency keys survive a database-write failure and changing
    // suppression state. A fixed key never represents different recipients.
    for (const row of rows) {
      const { data: pref, error: prefError } = await db.from('mail_preferences').select('*').eq('email', row.email).single();
      if (prefError) throw prefError;
      if (pref.opted_out_at) {
        const { error: skipError } = await db.from('mail_recipients').update({ status: 'skipped' }).eq('campaign_id', campaign.id).eq('email', row.email);
        if (skipError) throw skipError;
        continue;
      }
      const token = pref.unsubscribe_token;
      const { error: sendError, data } = await getResend().emails.send({
        from: fromAddress(), to: row.email, subject: campaign.subject,
        ...render(campaign, token), replyTo: 'contact@blbd.life',
        headers: { 'List-Unsubscribe': `<${appUrl()}/api/updates/unsubscribe?token=${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }, { idempotencyKey: `blbd-update/${campaign.id}/${createHash('sha256').update(row.email).digest('hex')}` });
      if (sendError || !data?.id) throw new AdminError('Email provider rejected a message. Accepted recipients are saved; resume this campaign instead of creating a duplicate.', 502);
      const { error: saveError } = await db.from('mail_recipients').update({ status: 'accepted', provider_id: data.id, accepted_at: new Date().toISOString() }).eq('campaign_id', campaign.id).eq('email', row.email);
      if (saveError) throw saveError;
      // Stay below the provider's default two requests/second.
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    const { count, error: countError } = await db.from('mail_recipients').select('*', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'pending');
    if (countError) throw countError;
    const complete = count === 0;
    const { error: updateError } = await db.from('mail_campaigns').update({ status: complete ? 'complete' : 'sending' }).eq('id', campaign.id).eq('lease_id', lease);
    if (updateError) throw updateError;
    return { complete };
  } finally {
    // A killed request leaves a bounded lease; a later request can resume.
    await db.from('mail_campaigns').update({ lease_id: null, lease_until: null }).eq('id', campaign.id).eq('lease_id', lease);
  }
}
