import { CommentsWidget } from '@/components/comments/CommentsWidget';

export const dynamic = 'force-dynamic';

/**
 * Frameable comment widget. The Webflow embed sets `?slug=` from the blog
 * post URL; see webflow/comment-embed.html.
 */
export default async function EmbedCommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const slug = (await searchParams).slug?.trim();

  if (!slug) {
    return (
      <p className="small muted center" style={{ padding: '2rem 1rem' }}>
        No post specified.
      </p>
    );
  }

  return <CommentsWidget slug={slug} />;
}
