/**
 * Only same-origin, path-style redirects are honoured. `//evil.com` and
 * `https://evil.com` both parse as absolute URLs in a browser, so an
 * unchecked `?next=` is an open-redirect.
 */
export function safeNext(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.startsWith('/\\')) return fallback;
  return value;
}
