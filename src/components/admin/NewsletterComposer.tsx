'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';

export function NewsletterComposer({ recipientCount }: { recipientCount: number }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<'test' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(testOnly: boolean) {
    if (
      !testOnly &&
      !window.confirm(`Send "${subject}" to ${recipientCount} subscribers? This can't be undone.`)
    ) {
      return;
    }

    setBusy(testOnly ? 'test' : 'send');
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, testOnly }),
      });

      const payload = (await response.json()) as { sent?: number; error?: string };

      if (!response.ok) {
        setError(payload.error ?? 'Send failed.');
      } else if (testOnly) {
        setNotice('Test sent to your own address.');
      } else {
        setNotice(`Sent to ${payload.sent} subscribers.`);
        setSubject('');
        setBody('');
      }
    } catch {
      setError('Network error.');
    }

    setBusy(null);
  }

  const ready = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="stack">
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Input
        label="Subject"
        maxLength={200}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />

      <Textarea
        label="Body"
        rows={14}
        value={body}
        hint="Plain text. Blank lines become paragraphs."
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="row wrap">
        <Button
          variant="secondary"
          loading={busy === 'test'}
          disabled={!ready || busy !== null}
          onClick={() => submit(true)}
        >
          Send test to me
        </Button>
        <Button
          loading={busy === 'send'}
          disabled={!ready || busy !== null || recipientCount === 0}
          onClick={() => submit(false)}
        >
          Send to {recipientCount} subscribers
        </Button>
      </div>
    </div>
  );
}
