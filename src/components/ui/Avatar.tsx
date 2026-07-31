/* eslint-disable @next/next/no-img-element */
import { initialsOf } from '@/lib/utils';

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
}

/**
 * Plain <img> rather than next/image: avatars come from a user-controlled
 * Supabase Storage URL and are already capped at 2 MB by the bucket, so the
 * optimizer buys little and would count against Vercel's transform quota.
 */
export function Avatar({ name, url, size = 40 }: AvatarProps) {
  const dimension = { width: size, height: size, fontSize: Math.max(11, size * 0.38) };

  return (
    <span className="avatar" style={dimension} aria-hidden="true">
      {url ? <img src={url} alt="" width={size} height={size} loading="lazy" /> : initialsOf(name)}
    </span>
  );
}
