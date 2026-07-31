'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { BlogComment, CommentWithAuthor, MembershipTier } from '@/lib/types';
import { canComment } from '@/lib/tiers';
import { createEmbedClient } from '@/lib/supabase/embed';
import { LoadingBlock } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { EmbedAuth } from './EmbedAuth';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

interface ViewerProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  membership_tier: MembershipTier;
  is_admin: boolean;
}

/** Notify the Webflow parent frame so it can size the iframe to fit. */
function useIframeResize(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!ref.current || typeof window === 'undefined' || window.parent === window) return;

    const post = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: 'blbd-resize', height }, '*');
    };

    post();
    const observer = new ResizeObserver(post);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
}

export function CommentsWidget({ slug }: { slug: string }) {
  const supabase = useMemo(() => createEmbedClient(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  useIframeResize(rootRef);

  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('blog_comments')
      .select(
        'id, post_slug, user_id, parent_id, content, is_edited, is_flagged, created_at, updated_at, author:profiles(display_name, avatar_url, membership_tier)',
      )
      .eq('post_slug', slug)
      .order('created_at', { ascending: true });

    if (loadError) {
      setError(loadError.message);
      return;
    }
    setComments((data ?? []) as unknown as CommentWithAuthor[]);
  }, [supabase, slug]);

  // Initial load + auth bootstrap.
  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      if (active) setSession(current);
      await loadComments();
      if (active) setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadComments]);

  // Fetch the viewer's profile (tier, admin, display) when signed in.
  useEffect(() => {
    if (!session?.user) {
      setViewer(null);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, membership_tier, is_admin')
        .eq('id', session.user.id)
        .single();
      if (active) setViewer((data as ViewerProfile | null) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [supabase, session]);

  // Realtime: new/edited/deleted comments for this slug. On any change we
  // reload — the payload lacks the joined author, and a reload keeps the
  // thread correct without hand-merging edge cases (deletes, edits, replies).
  useEffect(() => {
    const channel = supabase
      .channel(`comments:${slug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blog_comments', filter: `post_slug=eq.${slug}` },
        () => {
          void loadComments();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, slug, loadComments]);

  const post = useCallback(
    async (content: string, parentId: string | null): Promise<boolean> => {
      if (!session?.user) return false;
      setError(null);

      const { error: insertError } = await supabase.from('blog_comments').insert({
        post_slug: slug,
        user_id: session.user.id,
        parent_id: parentId,
        content,
      });

      if (insertError) {
        setError(insertError.message);
        return false;
      }
      await loadComments();
      return true;
    },
    [supabase, session, slug, loadComments],
  );

  const edit = useCallback(
    async (id: string, content: string): Promise<boolean> => {
      const { error: updateError } = await supabase
        .from('blog_comments')
        .update({ content })
        .eq('id', id);
      if (updateError) {
        setError(updateError.message);
        return false;
      }
      await loadComments();
      return true;
    },
    [supabase, loadComments],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('blog_comments').delete().eq('id', id);
      if (deleteError) setError(deleteError.message);
      await loadComments();
    },
    [supabase, loadComments],
  );

  const { topLevel, repliesByParent } = useMemo(() => groupComments(comments), [comments]);
  const viewerCanComment = canComment(viewer?.membership_tier);

  return (
    <div ref={rootRef} className="comments">
      <div className="comments__head">
        <h2>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </h2>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Composer / auth gate */}
      {!session ? (
        <EmbedAuth supabase={supabase} />
      ) : !viewerCanComment ? (
        <UpgradeGate />
      ) : (
        <CommentForm onSubmit={(content) => post(content, null)} />
      )}

      <div className="divider" aria-hidden="true">
        ✦
      </div>

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
              currentUserId={session?.user.id ?? null}
              isAdmin={viewer?.is_admin ?? false}
              canReply={viewerCanComment}
              onReply={(parentId, content) => post(content, parentId)}
              onEdit={edit}
              onDelete={remove}
            >
              {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={session?.user.id ?? null}
                  isAdmin={viewer?.is_admin ?? false}
                  onEdit={edit}
                  onDelete={remove}
                />
              ))}
            </CommentItem>
          ))}
        </div>
      )}
    </div>
  );
}

function groupComments(comments: CommentWithAuthor[]) {
  const topLevel: CommentWithAuthor[] = [];
  const repliesByParent = new Map<string, CommentWithAuthor[]>();

  for (const comment of comments) {
    if (comment.parent_id === null) {
      topLevel.push(comment);
    } else {
      const bucket = repliesByParent.get(comment.parent_id) ?? [];
      bucket.push(comment);
      repliesByParent.set(comment.parent_id, bucket);
    }
  }

  return { topLevel, repliesByParent };
}

function UpgradeGate() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return (
    <div className="comment-gate">
      <h3>Commenting is for supporters</h3>
      <p>Upgrade your membership to join the conversation.</p>
      <a
        className="btn btn--sm"
        href={`${appUrl}/checkout`}
        target="_blank"
        rel="noopener noreferrer"
      >
        See the tiers
      </a>
    </div>
  );
}

export type { BlogComment };
