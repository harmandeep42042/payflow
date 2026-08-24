'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AnalyticsIcon,
  AuditIcon,
  DashboardIcon,
  LogoutIcon,
  TransactionsIcon,
  UsersIcon,
  WalletIcon,
} from '../ui';

export const navigationGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
      { href: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/users', label: 'Users', icon: UsersIcon },
      { href: '/wallets', label: 'Wallets', icon: WalletIcon },
      { href: '/transactions', label: 'Transactions', icon: TransactionsIcon },
    ],
  },
  {
    label: 'Governance',
    items: [{ href: '/audit-logs', label: 'Audit Logs', icon: AuditIcon }],
  },
];

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin navigation" className="flex-1 space-y-7 px-3 py-6">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {group.label}
          </p>
          <ul className="mt-2 space-y-1">
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                    href={item.href}
                    className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  >
                    <item.icon className="size-[18px] shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ onLogout }: { onLogout: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          Payflow <span className="text-blue-600">Admin</span>
        </Link>
      </div>
      <SidebarNavigation />
      <div className="border-t border-slate-200 p-3">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Account
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogoutIcon className="size-[18px]" />
          Logout
        </button>
      </div>
    </aside>
  );
}
