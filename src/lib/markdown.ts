import { escapeHtml } from '@/lib/utils';

/**
 * Deliberately tiny markdown → HTML for comment bodies. Everything is escaped
 * first, so the only HTML that reaches the DOM is the handful of tags we
 * emit here — no user input can inject markup.
 *
 * Supports: **bold**, *italic*, `code`, and [text](http-url). Line breaks are
 * preserved by CSS (`white-space: pre-wrap`) on the container, so they are
 * left untouched here.
 */
export function renderCommentMarkdown(input: string): string {
  let html = escapeHtml(input);

  // Links first, before inline emphasis can chew up the brackets. Only
  // http(s) targets are allowed; the URL is re-escaped defensively.
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, text: string, url: string) =>
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>`,
  );

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

  return html;
}
