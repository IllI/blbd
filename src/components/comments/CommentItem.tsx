'use client';

import { useState } from 'react';
import type { CommentWithAuthor } from '@/lib/types';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/Badge';
import { displayNameOf, formatRelative } from '@/lib/utils';
import { renderCommentMarkdown } from '@/lib/markdown';
import { CommentForm } from './CommentForm';

interface CommentItemProps {
  comment: CommentWithAuthor;
  currentUserId: string | null;
  isAdmin?: boolean;
  canReply?: boolean;
  onReply?: (parentId: string, content: string) => Promise<boolean>;
  onEdit: (id: string, content: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  children?: React.ReactNode;
}

export function CommentItem({
  comment,
  currentUserId,
  isAdmin = false,
  canReply = false,
  onReply,
  onEdit,
  onDelete,
  children,
}: CommentItemProps) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);

  const isOwn = currentUserId != null && currentUserId === comment.user_id;
  const isTopLevel = comment.parent_id === null;
  const name = displayNameOf(comment.author);

  return (
    <article className={`comment${comment.is_flagged ? ' comment--flagged' : ''}`}>
      <Avatar name={name} url={comment.author?.avatar_url} size={36} />

      <div className="comment__body">
        <div className="comment__head">
          <span className="comment__author">{name}</span>
          {comment.author?.membership_tier === 'founding' && <TierBadge tier="founding" />}
          <span className="comment__time">
            {formatRelative(comment.created_at)}
            {comment.is_edited && ' · edited'}
          </span>
        </div>

        {editing ? (
          <CommentForm
            autoFocus
            compact
            submitLabel="Save"
            placeholder="Edit your comment…"
            onCancel={() => setEditing(false)}
            onSubmit={async (content) => {
              const ok = await onEdit(comment.id, content);
              if (ok) setEditing(false);
              return ok;
            }}
          />
        ) : (
          <div
            className="comment__content"
            dangerouslySetInnerHTML={{ __html: renderCommentMarkdown(comment.content) }}
          />
        )}

        {!editing && (
          <div className="comment__actions">
            {canReply && isTopLevel && onReply && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setReplying((value) => !value)}
              >
                Reply
              </button>
            )}
            {isOwn && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {(isOwn || isAdmin) && (
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  if (window.confirm('Delete this comment?')) void onDelete(comment.id);
                }}
              >
                Delete
              </button>
            )}
          </div>
        )}

        {replying && onReply && (
          <div style={{ marginTop: '0.625rem' }}>
            <CommentForm
              autoFocus
              compact
              submitLabel="Reply"
              placeholder={`Reply to ${name}…`}
              onCancel={() => setReplying(false)}
              onSubmit={async (content) => {
                const ok = await onReply(comment.id, content);
                if (ok) setReplying(false);
                return ok;
              }}
            />
          </div>
        )}

        {children && <div className="comment-replies">{children}</div>}
      </div>
    </article>
  );
}
