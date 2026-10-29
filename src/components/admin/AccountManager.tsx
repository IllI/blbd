'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';
import type { AdminAccount } from '@/lib/admin/types';

export function AccountManager() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  async function load(target: number) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/admin/accounts?page=${target}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      setAccounts(payload.accounts); setMore(payload.hasMore); setPage(target);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load accounts.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(1); }, []);
  async function save(account: AdminAccount) {
    if (!window.confirm(`Save ${account.email}? Admin access will be ${account.is_admin ? 'enabled' : 'disabled'}.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await fetch('/api/admin/accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      setNotice(`Saved ${account.email}.`); await load(page);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save account.'); }
    finally { setBusy(false); }
  }
  const edit = (id: string, values: Partial<AdminAccount>) => setAccounts(current => current.map(a => a.id === id ? { ...a, ...values } : a));
  return <div className="stack">
    {error && <Alert tone="error">{error}</Alert>}{notice && <Alert tone="success">{notice}</Alert>}
    <Input label="Filter this page by name or email" value={filter} onChange={e => setFilter(e.target.value)} />
    <p className="small muted">50 accounts per page. Admin grants take effect immediately; a verified email is required. Account deletion and billing changes are not performed here.</p>
    {accounts.filter(a => `${a.email} ${a.display_name}`.toLowerCase().includes(filter.toLowerCase())).map(a => <section className="card stack" key={a.id} aria-label={a.email}>
      <h2 className="admin-account-email">{a.email || 'No email'}</h2>
      <p className="small muted">{a.verified ? 'Verified' : 'Email not verified'} · Membership: {a.membership_tier}</p>
      <Input label={`Display name for ${a.email}`} value={a.display_name ?? ''} maxLength={100} disabled={busy} onChange={e => edit(a.id, { display_name: e.target.value })} />
      <label className="checkbox"><input type="checkbox" checked={a.is_admin} disabled={busy || !a.verified} onChange={e => edit(a.id, { is_admin: e.target.checked })} /><span>Admin — can manage users, permissions, and email updates</span></label>
      <Button disabled={busy} onClick={() => save(a)}>Save account</Button>
    </section>)}
    {!accounts.length && !busy && <p>No accounts found.</p>}
    <div className="row wrap"><Button variant="secondary" disabled={busy || page <= 1} onClick={() => load(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={busy || !more} onClick={() => load(page + 1)}>Next</Button></div>
  </div>;
}
