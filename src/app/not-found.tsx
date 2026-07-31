import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="status-page">
      <div className="status-page__inner stack">
        <div className="status-page__code" aria-hidden="true">
          404
        </div>
        <h1>Nothing here</h1>
        <p className="muted">This page moved, or never existed.</p>
        <div>
          <Link className="btn" href="/dashboard">
            Back to your dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
