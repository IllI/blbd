'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? 'Could not open the billing portal.');
        setLoading(false);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="secondary" loading={loading} onClick={open}>
        Manage billing
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </>
  );
}
