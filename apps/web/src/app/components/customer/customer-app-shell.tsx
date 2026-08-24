'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { PayflowUser } from '@payflow/shared-types';
import { getStoredUser, logoutUser } from '../../lib/api';
import NotificationBell from '../../dashboard/components/NotificationBell';
import { Avatar } from './ui';

const publicRoutes = new Set(['/', '/login', '/forgot-password', '/reset-password']);
const desktopNavigation = [
  { label: 'Home', href: '/dashboard', match: '/dashboard' },
  { label: 'Wallet', href: '/dashboard#wallets', match: '/wallet' },
  { label: 'Send', href: '/send-money', match: '/send-money' },
  { label: 'Receive', href: '/receive', match: '/receive' },
  { label: 'Transactions', href: '/transactions', match: '/transactions' },
  { label: 'Profile', href: '/profile', match: '/profile' },
];

const mobileNavigation = [
  { label: 'Home', href: '/dashboard', match: '/dashboard' },
  { label: 'Wallet', href: '/dashboard#wallets', match: '/wallet' },
  { label: 'Scan / Pay', href: '/scan', match: '/scan' },
  { label: 'Transactions', href: '/transactions', match: '/transactions' },
  { label: 'Profile', href: '/profile', match: '/profile' },
];

export function CustomerAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<PayflowUser | null>(null);

  useEffect(() => {
    const syncUser = (): void => setUser(getStoredUser());
    syncUser();
    window.addEventListener('storage', syncUser);
    window.addEventListener('focus', syncUser);
    window.addEventListener('payflow:auth-changed', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('focus', syncUser);
      window.removeEventListener('payflow:auth-changed', syncUser);
    };
  }, []);

  if (publicRoutes.has(pathname)) return children;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Customer';

  const active = (item: typeof desktopNavigation[number]) => item.label === 'Wallet'
    ? pathname === '/deposit' || pathname === '/withdraw' || pathname === '/transfer'
    : pathname === item.match || pathname.startsWith(`${item.match}/`);

  async function signOut(): Promise<void> {
    await logoutUser();
    router.replace('/login');
    router.refresh();
  }

  return <div className="min-h-screen bg-slate-50">
    <a href="#customer-content" className="sr-only z-[100] rounded bg-white p-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="text-xl font-extrabold tracking-tight text-slate-950" aria-label="Payflow home">Pay<span className="text-blue-600">flow</span></Link>
        <nav aria-label="Primary navigation" className="hidden flex-1 items-center gap-1 md:flex">
          {desktopNavigation.map((item) => <Link key={item.label} href={item.href} aria-current={active(item) ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${active(item) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>{item.label}</Link>)}
          <Link href="/services" aria-current={pathname === '/services' ? 'page' : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${pathname === '/services' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>More</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2"><NotificationBell /><Link href="/profile" className="flex items-center gap-2 rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Avatar name={name} /><span className="hidden max-w-36 truncate text-sm font-semibold text-slate-800 lg:block">{name}</span></Link><button type="button" onClick={() => void signOut()} className="hidden min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:block">Sign out</button></div>
      </div>
    </header>
    <div id="customer-content" tabIndex={-1} className="customer-content pb-24 md:pb-0">{children}</div>
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 md:hidden">
      {mobileNavigation.map((item) => <Link key={item.label} href={item.href} aria-current={active(item) ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center rounded-lg px-1 text-center text-[11px] font-bold ${active(item) ? 'text-blue-700' : 'text-slate-500'}`}><span aria-hidden="true" className={`mb-1 h-1.5 w-1.5 rounded-full ${active(item) ? 'bg-blue-600' : 'bg-slate-300'}`} />{item.label}</Link>)}
    </nav>
  </div>;
}
