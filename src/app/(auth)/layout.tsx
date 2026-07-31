import Link from 'next/link';
import { SITE_URL } from '@/lib/env';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand__name">Better Living Better Dying</div>
          <div className="auth-brand__mark" aria-hidden="true">
            ✹ ✦ ✹
          </div>
        </div>
        {children}
      </div>
      <p className="auth-back">
        <Link href={SITE_URL}>← Back to blbd.life</Link>
      </p>
    </div>
  );
}
