import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedPosts, webflowConfigured } from '@/lib/webflow';
import { Card, EmptyState } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import { SITE_URL } from '@/lib/env';

export const metadata: Metadata = { title: 'Blog' };

/**
 * The blog index, sourced live from the Webflow CMS. Authoring stays in
 * Webflow; this is the members' reading surface, where comments live.
 */
export default async function BlogIndexPage() {
  if (!webflowConfigured()) {
    return (
      <div className="stack-lg">
        <header className="page-header">
          <h1>Blog</h1>
        </header>
        <Card>
          <EmptyState title="Webflow CMS isn't connected yet">
            Set <code>WEBFLOW_API_TOKEN</code> and <code>WEBFLOW_BLOG_COLLECTION_ID</code> to pull
            posts in from Webflow. Until then, posts live at{' '}
            <Link href={`${SITE_URL}/blog`}>blbd.life/blog</Link>.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const posts = await getPublishedPosts();

  return (
    <div className="stack-lg">
      <header className="page-header">
        <h1>Blog</h1>
        <p>Writing on living well and dying well — and the conversation around it.</p>
      </header>

      {posts.length === 0 ? (
        <Card>
          <EmptyState title="No published posts yet">
            Drafts in Webflow stay hidden here until they&apos;re published.
          </EmptyState>
        </Card>
      ) : (
        <div className="post-list">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="post-card">
              {post.thumbnailUrl && (
                <div className="post-card__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.thumbnailUrl} alt="" loading="lazy" />
                </div>
              )}
              <div className="post-card__body">
                <div className="post-card__title">{post.title}</div>
                {post.summary && <p className="post-card__summary">{post.summary}</p>}
                {post.publishedAt && (
                  <div className="post-card__meta">{formatDate(post.publishedAt)}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
