import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAdmin, AdminError } from '@/lib/admin/auth';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try { await requireAdmin(); }
  catch (error) {
    if (error instanceof AdminError && error.status === 401) redirect('/login?next=%2Fadmin');
    if (error instanceof AdminError) notFound();
    throw error;
  }
  return <div className="stack-lg"><nav className="row wrap" aria-label="Administration">
    <Link href="/admin">Overview</Link><Link href="/admin/accounts">Accounts & permissions</Link><Link href="/admin/newsletter">Updates & audiences</Link>
  </nav>{children}</div>;
}
