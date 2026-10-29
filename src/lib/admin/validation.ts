import type { Audience } from './types';

export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function parseAudience(value: unknown): Audience {
  if (!value || typeof value !== 'object') throw new Error('Choose an audience.');
  const a = value as Record<string, unknown>;
  if (a.kind === 'all' || a.kind === 'members' || a.kind === 'subscribers') return { kind: a.kind };
  if (a.kind === 'group' && isUuid(a.groupId)) return { kind: 'group', groupId: a.groupId };
  if (a.kind === 'individuals' && Array.isArray(a.emails) && a.emails.length > 0 && a.emails.length <= 1000) {
    const emails = a.emails.map((v: unknown) => {
      if (typeof v !== 'string' || v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) throw new Error('Invalid recipient email.');
      return v.trim().toLowerCase();
    });
    return { kind: 'individuals', emails: [...new Set(emails)] };
  }
  throw new Error('Invalid audience.');
}
export function parseMessage(value: Record<string, unknown>) {
  if (typeof value.subject !== 'string' || !value.subject.trim() || value.subject.trim().length > 200) throw new Error('Enter a subject of 1–200 characters.');
  if (typeof value.body !== 'string' || !value.body.trim() || value.body.trim().length > 50000) throw new Error('Enter a message of 1–50,000 characters.');
  return { subject: value.subject.trim(), body: value.body.trim(), audience: parseAudience(value.audience) };
}
