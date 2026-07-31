import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Comments',
  robots: { index: false, follow: false },
};

/**
 * Minimal shell for iframe widgets. It renders inside the root layout's
 * <body>, so it can't own <html>/<body> — instead it forces a transparent
 * background so the widget blends into whatever Webflow page frames it.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body{background:transparent !important;}`}</style>
      <div className="embed-root">{children}</div>
    </>
  );
}
