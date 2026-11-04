'use client';
import { Button } from '@/components/ui/Button';
import type { MailCampaign, MailReadiness } from '@/lib/admin/types';

export type ReviewedCampaign = MailCampaign & { accepted: number; pending: number; skipped: number };
type Props = {
  campaign: ReviewedCampaign; audienceName: string; mail: MailReadiness;
  busy: boolean; sending: boolean; approved: boolean;
  onApprove: (value: boolean) => void; onTest: () => void; onSend: () => void;
  onCopy: () => void; onPause: () => void;
};

/** One selected message, with the exact next action beside its preview. */
export function CampaignReview({ campaign: c, audienceName, mail, busy, sending, approved,
  onApprove, onTest, onSend, onCopy, onPause }: Props) {
  const recipients = `${c.recipient_count} ${c.recipient_count === 1 ? 'recipient' : 'recipients'}`;
  return <section className="admin-review" aria-label="Selected email">
    <article className="card stack admin-email-preview">
      <p className="small muted">EMAIL PREVIEW</p>
      <h2 className="admin-account-email">{c.subject}</h2>
      <p><strong>To:</strong> {audienceName} · {recipients}</p>
      {c.audience.kind === 'individuals' && <p className="small admin-account-email">{c.audience.emails.join(', ')}</p>}
      <div className="admin-email-body">{c.body}</div>
      <p className="small muted">Reply-to: contact@blbd.life. Sender details and unsubscribe links are added to audience emails.</p>
      <Button variant="secondary" disabled={busy} onClick={onCopy}>Use this message in a new draft</Button>
    </article>
    <aside className="card stack admin-send-panel" aria-label="Test and send">
      <h2>{c.status === 'complete' ? 'Send complete' : 'Send this update'}</h2>
      {c.status === 'complete' ? <>
        <p>{c.accepted} accepted by the email provider. This is not a delivery/open count.</p>
        {c.skipped > 0 && <p>{c.skipped} contacts were skipped.</p>}
      </> : <>
        <div className="stack">
          <h3>{c.tested_at ? '✓ Test email sent' : 'First, send yourself a test'}</h3>
          <p className="small">{c.tested_at ? 'Your draft has a successful test. Check it in your inbox before sending to the audience.' : 'Only your signed-in email receives the test—not your audience.'}</p>
          <Button variant={c.tested_at ? 'secondary' : 'primary'} disabled={busy || !mail.canTest} onClick={onTest}>{c.tested_at ? 'Send another test to myself' : 'Send test to myself'}</Button>
          {!mail.canTest && <p role="status">Test emails need administrator setup. See the setup details below.</p>}
        </div>
        {!mail.canSend ? <div className="admin-send-blocker stack" role="status">
          <h3>{mail.needsPostalAddress ? 'Mailing address needed before sending to everyone' : 'Audience sending is switched off'}</h3>
          <p>{mail.needsPostalAddress
            ? 'BLBD’s physical mailing address or PO box is missing from the email footer. contact@blbd.life is the reply-to email, not a mailing address.'
            : 'An administrator needs to finish the beta sending setup. Your test can succeed while audience sending is off.'}</p>
          <p>Your draft{c.tested_at ? ' and successful test are' : ' is'} saved. {mail.needsPostalAddress ? 'We are holding off on the address as requested; audience sends will remain paused until it is supplied and sending is activated.' : 'No audience emails have been sent by this action.'}</p>
          <a href="https://github.com/IllI/blbd/issues/6" target="_blank" rel="noreferrer">View the sending-setup task →</a>
          <details><summary>Technical setup details</summary><ul>{mail.sendBlockers.map(reason => <li key={reason}>{reason}</li>)}</ul></details>
        </div> : <div className="stack">
          <h3>Then, send to {recipients}</h3>
          {!c.tested_at ? <p>Send a test first. The audience-send controls will appear after it succeeds.</p> : <>
            <label className="checkbox"><input type="checkbox" disabled={busy} checked={approved} onChange={e => onApprove(e.target.checked)} /><span>I checked my test email and approve sending to this audience. Emails cannot be recalled.</span></label>
            <Button disabled={busy || !approved} onClick={onSend}>{c.status === 'sending' ? `Resume sending to ${recipients}` : `Send to ${recipients}`}</Button>
          </>}
        </div>}
        {sending && <Button variant="danger" onClick={onPause}>Pause after current batch</Button>}
        {c.status === 'sending' && <p className="small">This send has already started. Resume this draft to avoid sending duplicates.</p>}
      </>}
      {(c.status === 'sending' || c.status === 'complete') && <details><summary>Delivery details</summary><p>{c.accepted} accepted · {c.skipped} skipped · {c.pending} remaining</p></details>}
    </aside>
  </section>;
}
