import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/lib/webflow';
import { getSessionProfile } from '@/lib/supabase/server';
import { PostComments } from '@/components/comments/PostComments';
import { formatDate } from '@/lib/utils';
import type { Profile } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = await getPostBySlug((await params).slug);
  return { title: post?.title ?? 'Post' };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const { user, profile } = await getSessionProfile();
  const typed = profile as Profile | null;

  return (
    <article className="stack-lg">
      <Link href="/blog" className="small muted">
        ← All posts
      </Link>

      <header className="post-hero">
        {post.mainImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="post-hero__image" src={post.mainImageUrl} alt="" />
        )}
        <h1>{post.title}</h1>
        {post.publishedAt && <p className="muted small">{formatDate(post.publishedAt)}</p>}
        {post.summary && <p className="muted">{post.summary}</p>}
      </header>

      {post.bodyHtml ? (
        // Trusted source: this HTML is authored by BLBD staff in the Webflow
        // Designer and fetched over an authenticated API — not user input.
        <div className="post-body" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
      ) : (
        <p className="muted">This post has no body content yet.</p>
      )}

      <div className="divider" aria-hidden="true">
        ✹ ✦ ✹
      </div>

      <PostComments
        slug={post.slug}
        currentUserId={user?.id ?? null}
        tier={typed?.membership_tier ?? 'free'}
        isAdmin={typed?.is_admin ?? false}
      />
    </article>
  );
}
