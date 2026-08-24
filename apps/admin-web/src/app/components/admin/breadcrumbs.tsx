'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const labels: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  wallets: 'Wallets',
  transactions: 'Transactions',
  analytics: 'Analytics',
  'audit-logs': 'Audit Logs',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm text-slate-500">
        <li>
          <Link className="hover:text-slate-900" href="/dashboard">
            Admin
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const current = index === segments.length - 1;
          return (
            <li className="flex min-w-0 items-center gap-2" key={href}>
              <span aria-hidden="true">/</span>
              {current ? (
                <span
                  aria-current="page"
                  className="truncate font-medium text-slate-800"
                >
                  {labels[segment] ?? 'Details'}
                </span>
              ) : (
                <Link className="hover:text-slate-900" href={href}>
                  {labels[segment] ?? segment}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
