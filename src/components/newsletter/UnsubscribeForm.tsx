'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Alert';

export function UnsubscribeForm() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        setError(payload.error ?? 'Please try again.');
      } else {
        setDone(true);
      }
    } catch {
      setError('Network error.');
    }
    setLoading(false);
  }

  if (done) {
    return <Alert tone="success">If that address was subscribed, it&apos;s now removed.</Alert>;
  }

  return (
    <form className="stack" onSubmit={onSubmit} style={{ textAlign: 'left' }} noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" block loading={loading}>
        Unsubscribe
      </Button>
    </form>
  );
}
