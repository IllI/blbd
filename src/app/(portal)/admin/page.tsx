import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { mailConfiguration } from '@/lib/admin/mail';
export default async function AdminPage() {
  await requireAdmin();
  const db = createAdminClient();
  const { data: audit, error } = await db.from('admin_audit').select('*').order('created_at', { ascending: false }).limit(30);
  const { data: invitations } = await db.from('admin_bootstrap').select('email, claimed_at').order('email');
  return <><header className="page-header"><h1>BLBD administration</h1><p>Manage accounts, permissions, and email updates.</p></header>
    <div className="grid grid--2"><Link className="card" href="/admin/accounts">Accounts & permissions →</Link><Link className="card" href="/admin/newsletter">Compose an update →</Link></div>
    <p role="status">Update sending: {mailConfiguration().canSend ? 'enabled' : 'disabled — configuration and activation required'}.</p>
    <section className="stack"><h2>Initial admin access</h2><p className="muted">Each address must have a verified BLBD account. Google Workspace mailboxes alone are not portal accounts. Revoked access is never automatically restored.</p>
      {(invitations ?? []).map(i => <p key={i.email}>{i.email} — {i.claimed_at ? 'initial grant claimed (see Accounts for current permissions)' : 'awaiting verified account'}</p>)}
    </section>
    <section className="stack"><h2>Recent activity</h2>{error ? <p role="alert">Apply the admin migration before using this portal.</p> : !audit?.length ? <p>No activity yet.</p> : audit.map(a => <div className="card" key={a.id}><strong>{a.action.replaceAll('_', ' ')}</strong><p className="small muted">{new Date(a.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central · Actor {a.actor_id ?? 'deleted account'} · Target {a.target_id ?? '—'}</p></div>)}</section>
  </>;
}
