'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import type { Audience, MailCampaign, MailContact, MailGroup } from '@/lib/admin/types';
type Campaign = MailCampaign & { accepted: number; pending: number; skipped: number };
type MailState = { contacts: MailContact[]; groups: MailGroup[]; campaigns: Campaign[]; mail: { canSend: boolean } };

export function NewsletterComposer() {
  const [data, setData] = useState<MailState | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Audience['kind']>('subscribers');
  const [selected, setSelected] = useState<string[]>([]);
  const [groupId, setGroupId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [prepared, setPrepared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const stop = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { stop.current = true; mounted.current = false; }; }, []);
  async function load(q = search, start = offset) {
    const res = await fetch(`/api/admin/mail?q=${encodeURIComponent(q)}&offset=${start}`, { cache: 'no-store' });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error);
    if (mounted.current) setData(payload);
  }
  // One initial fetch; later loads use the explicit Search/pagination actions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load('', 0).catch(e => setError(e.message)); }, []);
  function changed() { setPrepared(null); setNotice(''); }
  function audience(): Audience {
    if (kind === 'individuals') return { kind, emails: selected };
    if (kind === 'group') return { kind, groupId };
    return { kind };
  }
  async function post(input: Record<string, unknown>) {
    const res = await fetch('/api/admin/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error ?? 'Request failed.');
    return payload;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function prepare() {
    const preview = await post({ action: 'preview', audience: audience() });
    if (!preview.count) throw new Error('No eligible recipients. Pending subscriptions and opted-out contacts are excluded.');
    const { id } = await post({ action: 'prepare', subject, body, audience: audience() });
    setPrepared(id); await load();
    setNotice('Draft saved. Review its frozen audience count below, then send yourself a test.');
  }
  async function send(c: Campaign) {
    if (!window.confirm(`Send “${c.subject}” to up to ${c.recipient_count} contacts? ${c.accepted} already accepted; opted-out contacts will be skipped. This cannot be undone.`)) return;
    stop.current = false; setSending(true);
    try {
      let complete = false;
      while (!complete && !stop.current) {
        const result = await post({ action: 'send', id: c.id, confirmCount: c.recipient_count });
        complete = result.complete;
        if (mounted.current) await load();
      }
      if (mounted.current) setNotice(complete ? 'Campaign complete. “Accepted” means the provider accepted the message, not confirmed inbox delivery.' : 'Paused after the current batch. Resume this same campaign to continue.');
    } finally { if (mounted.current) setSending(false); }
  }
  return <div className="stack-lg">
    {error && <Alert tone="error">{error}</Alert>}{notice && <Alert tone="success">{notice}</Alert>}
    {data && !data.mail.canSend && <Alert tone="info">Sending is disabled until the email provider and beta launch settings are configured. You can still manage audiences and prepare drafts.</Alert>}
    <section className="card stack"><h2>Compose an update</h2>
      <Input label="Subject" value={subject} maxLength={200} disabled={busy} onChange={e => { setSubject(e.target.value); changed(); }} />
      <Textarea label="Message" hint="Plain text; blank lines become paragraphs. Unsubscribe and sender details are added automatically." value={body} rows={10} maxLength={50000} disabled={busy} onChange={e => { setBody(e.target.value); changed(); }} />
      <label className="field">Audience<select className="input" value={kind} disabled={busy} onChange={e => { setKind(e.target.value as Audience['kind']); changed(); }}>
        <option value="subscribers">Confirmed subscribers</option><option value="members">All verified member accounts (including free members)</option><option value="all">Members + subscribers (deduplicated)</option><option value="individuals">Selected individuals</option><option value="group">Saved group</option>
      </select></label>
      {kind === 'group' && <label className="field">Group<select className="input" value={groupId} disabled={busy} onChange={e => { setGroupId(e.target.value); changed(); }}><option value="">Choose a group</option>{data?.groups.map(g => <option value={g.id} key={g.id}>{g.name} ({g.emails.length})</option>)}</select></label>}
      <p className="small muted">Opt-outs apply to every audience. Members are verified portal accounts; subscribers must have confirmed their subscription. Webflow-only form records are not automatically imported into this database.</p>
      {kind === 'individuals' && <p>{selected.length} selected — use the contact picker below.</p>}
      <Button disabled={busy || !data || !subject.trim() || !body.trim()} onClick={() => run(prepare)}>Review audience & save draft</Button>
      {prepared && <p>Draft {prepared} is ready for review below.</p>}
    </section>
    <section className="card stack"><h2>Contacts & groups</h2>
      <form className="row wrap" onSubmit={e => { e.preventDefault(); setOffset(0); void run(() => load(search, 0)); }}><Input label="Find contacts by email" value={search} onChange={e => setSearch(e.target.value)} /><Button type="submit" disabled={busy}>Search</Button></form>
      <div className="admin-contact-list">{data?.contacts.map(c => <label className="checkbox" key={c.email}><input type="checkbox" checked={selected.includes(c.email)} disabled={busy || c.opted_out} onChange={e => { setSelected(s => e.target.checked ? [...s, c.email] : s.filter(v => v !== c.email)); changed(); }} /><span className="admin-account-email">{c.email}<small className="muted"> {c.member ? 'Member ' : ''}{c.subscriber ? 'Subscriber ' : ''}{c.opted_out ? '(opted out)' : ''}</small></span></label>)}</div>
      <div className="row wrap"><Button variant="secondary" disabled={busy || offset === 0} onClick={() => run(async () => { await load(search, offset - 100); setOffset(offset - 100); })}>Previous contacts</Button><Button variant="secondary" disabled={busy || (data?.contacts.length ?? 0) < 100} onClick={() => run(async () => { await load(search, offset + 100); setOffset(offset + 100); })}>Next contacts</Button><Button variant="ghost" disabled={busy || !selected.length} onClick={() => { setSelected([]); changed(); }}>Clear selection ({selected.length})</Button></div>
      <Input label="New group name" value={groupName} maxLength={100} disabled={busy} onChange={e => setGroupName(e.target.value)} />
      <Button variant="secondary" disabled={busy || !selected.length || !groupName.trim()} onClick={() => run(async () => { await post({ action: 'group', name: groupName, emails: selected }); setGroupName(''); await load(); setNotice('Group saved. Choose Saved group when composing.'); })}>Save selected contacts as a group</Button>
    </section>
    <section className="stack"><h2>Drafts & recent campaigns</h2>
      {sending && <Button variant="danger" onClick={() => { stop.current = true; }}>Pause after current batch</Button>}
      {data?.campaigns.map(c => <article className="card stack" key={c.id}>
        <h3 className="admin-account-email">{c.subject}</h3><p>{c.recipient_count} in reviewed audience · {c.accepted} accepted · {c.skipped} skipped · {c.pending} pending · {c.status}</p>
        <details><summary>Review message & audience</summary><p className="admin-account-email">{JSON.stringify(c.audience)}</p><pre className="admin-message-preview">{c.body}</pre></details>
        <p className="small muted">{c.tested_at ? `Test accepted ${new Date(c.tested_at).toLocaleString()}` : 'A successful test is required before sending.'}</p>
        <div className="row wrap"><Button variant="secondary" disabled={busy || !data.mail.canSend} onClick={() => run(async () => { await post({ action: 'test', id: c.id }); await load(); setNotice('Test accepted by the provider for your own signed-in address. Review it in your inbox.'); })}>Send test to me</Button>
          <Button disabled={busy || !data.mail.canSend || !c.tested_at || c.status === 'complete'} onClick={() => run(() => send(c))}>{c.status === 'sending' ? 'Resume campaign' : 'Send reviewed update'}</Button>
        </div>
      </article>)}
      {data && !data.campaigns.length && <p>No drafts yet.</p>}
    </section>
  </div>;
}
