'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Profile } from '@/lib/types';
import { canViewDirectory } from '@/lib/tiers';
import { createClient } from '@/lib/supabase/client';
import { displayNameOf } from '@/lib/utils';
import { SITE_URL } from '@/lib/env';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/Badge';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Rendered greyed-out with a lock when the tier doesn't include it. */
  locked?: boolean;
}

export function PortalShell({
  profile,
  email,
  children,
}: {
  profile: Profile | null;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // Close the drawer on navigation so it doesn't linger over the new page.
  useEffect(() => setNavOpen(false), [pathname]);

  const name = displayNameOf(profile);

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: '◈' },
    { href: '/blog', label: 'Blog', icon: '✎' },
    { href: '/goals', label: 'Goals', icon: '✹' },
    { href: '/profile', label: 'Profile', icon: '◉' },
    {
      href: '/community',
      label: 'Community',
      icon: '❋',
      locked: !canViewDirectory(profile?.membership_tier),
    },
    { href: '/settings', label: 'Settings', icon: '⚙' },
  ];

  if (profile?.is_admin) {
    items.push({ href: '/admin/newsletter', label: 'Newsletter', icon: '✉' });
  }

  return (
    <div className="portal">
      {navOpen && <div className="portal-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <nav className="portal-nav" data-open={navOpen} aria-label="Member portal">
        <div className="portal-nav__brand">
          BLBD
          <span>Member portal</span>
        </div>

        <div className="portal-nav__list">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`portal-nav__link${item.locked ? ' portal-nav__link--locked' : ''}`}
              >
                <span className="portal-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
                {item.locked && (
                  <span className="portal-nav__lock" title="Upgrade to unlock" aria-label="Upgrade to unlock">
                    🔒
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="portal-nav__footer stack-sm">
          <TierBadge tier={profile?.membership_tier} />
          <Link className="small muted" href={SITE_URL}>
            ← Back to blbd.life
          </Link>
        </div>
      </nav>

      <div className="portal-main">
        <header className="portal-header">
          <div className="row">
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navOpen}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <Link href={SITE_URL} className="small muted">
              ← blbd.life
            </Link>
          </div>

          <UserMenu name={name} email={email} avatarUrl={profile?.avatar_url} />
        </header>

        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar name={name} url={avatarUrl} size={30} />
        {name}
      </button>

      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__meta">
            <strong>{name}</strong>
            <div>{email}</div>
          </div>
          <Link href="/profile" role="menuitem">
            Edit profile
          </Link>
          <Link href="/settings" role="menuitem">
            Settings
          </Link>
          <button type="button" role="menuitem" onClick={signOut} disabled={signingOut}>
            {signingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}
