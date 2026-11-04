import { isUuid } from '@/lib/admin/validation';
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token, done } = await searchParams;
  return <main className="status-page"><div className="status-page__inner stack">
    <h1>BLBD email updates</h1>
    {done === '1' ? <p>Your preference has been saved. You will no longer receive BLBD update emails. Account security emails are unaffected.</p>
      : isUuid(token) ? <><p>Stop receiving BLBD updates? This applies to subscriber, member, and group updates.</p>
        <form method="post" action={`/api/updates/unsubscribe?token=${token}`}><button className="btn" type="submit">Unsubscribe</button></form></>
        : <p>Use the unsubscribe link in a BLBD update email.</p>}
  </div></main>;
}
