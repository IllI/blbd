'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CommentWithAuthor, MembershipTier } from '@/lib/types';
import { canComment } from '@/lib/tiers';
import { createClient } from '@/lib/supabase/client';
import { LoadingBlock } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

/**
 * In-portal comment thread for a blog post.
 *
 * Same data as the Webflow iframe widget, but this one runs inside the
 * authenticated portal, so it uses the cookie-backed Supabase client and gets
 * the viewer's identity from the server rather than re-authenticating.
 */
export function PostComments({
  slug,
  currentUserId,
  tier,
  isAdmin,
}: {
  slug: string;
  currentUserId: string | null;
  tier: MembershipTier;
  isAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('blog_comments')
      .select(
        'id, post_slug, user_id, parent_id, content, is_edited, is_flagged, created_at, updated_at, author:profiles(display_name, avatar_url, membership_tier)',
      )
      .eq('post_slug', slug)
      .order('created_at', { ascending: true });

    if (loadError) setError(loadError.message);
    else setComments((data ?? []) as unknown as CommentWithAuthor[]);
  }, [supabase, slug]);

  useEffect(() => {
    let active = true;
    (async () => {
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // Live updates while reading.
  useEffect(() => {
    const channel = supabase
      .channel(`post-comments:${slug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blog_comments', filter: `post_slug=eq.${slug}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, slug, load]);

  const post = useCallback(
    async (content: string, parentId: string | null) => {
      if (!currentUserId) return false;
      setError(null);
      const { error: insertError } = await supabase
        .from('blog_comments')
        .insert({ post_slug: slug, user_id: currentUserId, parent_id: parentId, content });
      if (insertError) {
        setError(insertError.message);
        return false;
      }
      await load();
      return true;
    },
    [supabase, currentUserId, slug, load],
  );

  const edit = useCallback(
    async (id: string, content: string) => {
      const { error: e } = await supabase.from('blog_comments').update({ content }).eq('id', id);
      if (e) {
        setError(e.message);
        return false;
      }
      await load();
      return true;
    },
    [supabase, load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: e } = await supabase.from('blog_comments').delete().eq('id', id);
      if (e) setError(e.message);
      await load();
    },
    [supabase, load],
  );

  const topLevel = comments.filter((c) => c.parent_id === null);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const mayComment = canComment(tier);

  return (
    <section className="comments" id="comments">
      <div className="comments__head">
        <h2>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </h2>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {mayComment ? (
        <CommentForm onSubmit={(content) => post(content, null)} />
      ) : (
        <div className="comment-gate">
          <h3>Commenting is for supporters</h3>
          <p>Upgrade your membership to join the conversation.</p>
          <Link className="btn btn--sm" href="/checkout">
            See the tiers
          </Link>
        </div>
      )}

      {loading ? (
        <LoadingBlock label="Loading comments…" />
      ) : topLevel.length === 0 ? (
        <p className="small muted center">Be the first to share a thought.</p>
      ) : (
        <div className="comment-list">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              canReply={mayComment}
              onReply={(parentId, content) => post(content, parentId)}
              onEdit={edit}
              onDelete={remove}
            >
              {repliesOf(comment.id).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onEdit={edit}
                  onDelete={remove}
                />
              ))}
            </CommentItem>
          ))}
        </div>
      )}
    </section>
  );
}
