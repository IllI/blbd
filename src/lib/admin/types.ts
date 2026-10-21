export type Audience =
  | { kind: 'all' | 'members' | 'subscribers' }
  | { kind: 'individuals'; emails: string[] }
  | { kind: 'group'; groupId: string };
export type MailContact = { email: string; name: string | null; member: boolean; subscriber: boolean; opted_out: boolean };
export type MailGroup = { id: string; name: string; emails: string[]; created_by: string | null; created_at: string };
export type MailCampaign = {
  id: string; created_by: string | null; subject: string; body: string; audience: Audience;
  recipient_count: number; status: 'draft' | 'sending' | 'complete'; lease_id: string | null;
  lease_until: string | null; started_at: string | null; tested_at: string | null; created_at: string;
};
export type MailRecipient = { campaign_id: string; email: string; status: 'pending' | 'accepted' | 'skipped'; provider_id: string | null; accepted_at: string | null };
export type MailPreference = { email: string; unsubscribe_token: string; opted_out_at: string | null };
export type AuditEntry = { id: string; actor_id: string | null; action: string; target_id: string | null; details: Record<string, unknown>; created_at: string };
export type AdminAccount = { id: string; email: string; display_name: string | null; is_admin: boolean; membership_tier: string; verified: boolean; created_at: string };
