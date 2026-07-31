import 'server-only';
import { requireEnv } from '@/lib/env';

/**
 * Read-only Webflow CMS client.
 *
 * Webflow stays the authoring surface — Dan and any content editors keep
 * working in the Webflow Designer, which is what the CMS plan is paying for.
 * The portal pulls that content through the Data API and renders it inside
 * the member experience, where our own auth, tiers, and comments apply.
 *
 * Responses are cached with ISR so normal traffic doesn't burn Webflow's API
 * rate limit (60 req/min).
 */

const API = 'https://api.webflow.com/v2';

/** Seconds before a cached CMS response is refetched. */
const REVALIDATE = 300;

export interface WebflowPost {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  bodyHtml: string | null;
  mainImageUrl: string | null;
  thumbnailUrl: string | null;
  featured: boolean;
  publishedAt: string | null;
}

interface RawItem {
  id: string;
  lastPublished?: string | null;
  createdOn?: string | null;
  isDraft?: boolean;
  isArchived?: boolean;
  fieldData: Record<string, unknown>;
}

function imageUrl(value: unknown): string | null {
  if (value && typeof value === 'object' && 'url' in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === 'string' ? url : null;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function toPost(item: RawItem): WebflowPost {
  const f = item.fieldData;
  return {
    id: item.id,
    slug: str(f.slug) ?? item.id,
    title: str(f.name) ?? 'Untitled',
    summary: str(f['post-summary']),
    bodyHtml: str(f['post-body']),
    mainImageUrl: imageUrl(f['main-image']),
    thumbnailUrl: imageUrl(f['thumbnail-image']) ?? imageUrl(f['main-image']),
    featured: f.featured === true,
    publishedAt: item.lastPublished ?? item.createdOn ?? null,
  };
}

async function wf<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${requireEnv('WEBFLOW_API_TOKEN')}`,
      'accept-version': '2.0.0',
    },
    next: { revalidate: REVALIDATE, tags: ['webflow-cms'] },
  });

  if (!res.ok) {
    throw new Error(`Webflow GET ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Live (published, non-archived) blog posts, newest first.
 * Returns [] rather than throwing so a Webflow outage degrades the page
 * instead of taking the whole portal down.
 */
export async function getPublishedPosts(): Promise<WebflowPost[]> {
  try {
    const collectionId = requireEnv('WEBFLOW_BLOG_COLLECTION_ID');
    const data = await wf<{ items: RawItem[] }>(
      `/collections/${collectionId}/items/live?limit=100`,
    );

    return (data.items ?? [])
      .filter((item) => !item.isDraft && !item.isArchived)
      .map(toPost)
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  } catch (error) {
    console.error('[webflow] getPublishedPosts failed', error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<WebflowPost | null> {
  const posts = await getPublishedPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}

/** True when the CMS integration is configured at all. */
export function webflowConfigured(): boolean {
  return Boolean(process.env.WEBFLOW_API_TOKEN && process.env.WEBFLOW_BLOG_COLLECTION_ID);
}
