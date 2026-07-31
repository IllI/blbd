'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const MAX_LENGTH = 5000;

export function CommentForm({
  onSubmit,
  placeholder = 'Add to the conversation…',
  submitLabel = 'Post',
  autoFocus = false,
  compact = false,
  onCancel,
}: {
  onSubmit: (content: string) => Promise<boolean>;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  compact?: boolean;
  onCancel?: () => void;
}) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    const ok = await onSubmit(trimmed);
    setSubmitting(false);
    if (ok) setContent('');
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <textarea
        className="textarea"
        value={content}
        placeholder={placeholder}
        maxLength={MAX_LENGTH}
        rows={compact ? 2 : 3}
        autoFocus={autoFocus}
        onChange={(e) => setContent(e.target.value)}
        aria-label={placeholder}
      />
      <div className="comment-form__actions">
        <span className="comment-form__count">
          {content.length > MAX_LENGTH - 200 ? `${MAX_LENGTH - content.length} left` : ''}
          <span className="muted"> Supports **bold**, *italic*, `code`</span>
        </span>
        <div className="row">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" loading={submitting} disabled={!content.trim()}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
