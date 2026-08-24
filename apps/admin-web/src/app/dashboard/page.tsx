'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AdminShell,
  ErrorState,
  MetricCard,
  PageHeader,
} from '../components/admin';
import {
  AnalyticsIcon,
  ArrowUpRightIcon,
  Button,
  Card,
  RefreshIcon,
  Skeleton,
  StatusBadge,
  TransactionsIcon,
  UsersIcon,
  WalletIcon,
} from '../components/ui';
import {
  LatestDashboardRequest,
  normalizeDashboard,
  type DashboardData,
} from '../components/dashboard';
import { formatTransactionAmount, formatTransactionDate } from '../components/transactions';
import {
  AdminUser,
  adminAuthenticatedRequest,
  clearAdminSession,
  logoutAdmin,
  restoreAdminSession,
} from '../lib/api';

function formatDate(value: string): string {
  return formatTransactionDate(value);
}
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading admin dashboard"
      className="min-h-screen bg-[#F6F8FA] p-4 sm:p-8"
    >
      <div className="mx-auto max-w-7xl">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-40" key={index} />
          ))}
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-80 xl:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const latestRequestRef = useRef(new LatestDashboardRequest());

  const loadDashboard = useCallback(async (): Promise<void> => {
    const { controller, requestId } = latestRequestRef.current.begin();
    try {
      setError('');
      setIsLoading(true);
      const response =
        await adminAuthenticatedRequest<unknown>(
          '/admin/dashboard',
          { signal: controller.signal },
        );
      if (!latestRequestRef.current.isLatest(requestId)) return;
      setDashboard(normalizeDashboard(response));
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      if (!latestRequestRef.current.isLatest(requestId)) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load admin dashboard',
      );
    } finally {
      if (latestRequestRef.current.isLatest(requestId)) setIsLoading(false);
    }
  }, []);

  useEffect(() => () => latestRequestRef.current.abort(), []);

  useEffect(() => {
    void restoreAdminSession()
      .then((storedAdmin) => {
        setAdmin(storedAdmin);
        return loadDashboard();
      })
      .catch(() => {
        clearAdminSession();
        router.replace('/login');
      });
  }, [loadDashboard, router]);
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadDashboard();
    }, 10_000);
    return () => window.clearInterval(intervalId);
  }, [autoRefreshEnabled, loadDashboard]);

  async function handleLogout(): Promise<void> {
    await logoutAdmin();
    router.push('/login');
    router.refresh();
  }
  if (!admin || (isLoading && !dashboard)) return <DashboardLoading />;

  const stats = dashboard?.stats;
  const adminDisplayName =
    typeof admin.firstName === 'string' && admin.firstName.trim()
      ? admin.firstName.trim()
      : 'Admin';
  const primaryMetrics = [
    {
      label: 'Total users',
      value: String(stats?.totalUsers ?? 0),
      description: `${stats?.activeUsers ?? 0} active users`,
      icon: <UsersIcon className="size-5" />,
    },
    {
      label: 'Total wallets',
      value: String(stats?.totalWallets ?? 0),
      description: `${stats?.activeWallets ?? 0} active wallets`,
      icon: <WalletIcon className="size-5" />,
    },
    {
      label: 'Transactions',
      value: String(stats?.totalTransactions ?? 0),
      description: `${stats?.totalDeposits ?? 0} deposits, ${stats?.totalTransfers ?? 0} transfers`,
      icon: <TransactionsIcon className="size-5" />,
    },
    {
      label: 'Restricted records',
      value: String((stats?.blockedUsers ?? 0) + (stats?.suspendedUsers ?? 0) + (stats?.frozenWallets ?? 0)),
      description: 'Blocked, suspended or frozen',
      icon: <AnalyticsIcon className="size-5" />,
    },
  ];
  const activityGroups = [
    {
      label: 'User accounts',
      total: stats?.totalUsers ?? 0,
      items: [
        ['Active', stats?.activeUsers ?? 0],
        ['Suspended', stats?.suspendedUsers ?? 0],
        ['Blocked', stats?.blockedUsers ?? 0],
      ],
    },
    {
      label: 'Wallet states',
      total: stats?.totalWallets ?? 0,
      items: [
        ['Active', stats?.activeWallets ?? 0],
        ['Frozen', stats?.frozenWallets ?? 0],
        ['Closed', stats?.closedWallets ?? 0],
      ],
    },
    {
      label: 'Transaction mix',
      total: stats?.totalTransactions ?? 0,
      items: [
        ['Deposits', stats?.totalDeposits ?? 0],
        ['Withdrawals', stats?.totalWithdrawals ?? 0],
        ['Transfers', stats?.totalTransfers ?? 0],
      ],
    },
  ];

  return (
    <AdminShell admin={admin} onLogout={() => void handleLogout()}>
      <PageHeader
        eyebrow="Admin overview"
        title={`${greeting()}, ${adminDisplayName}`}
        description="Monitor users, wallets and transaction activity across Payflow."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex min-h-10 items-center gap-3 rounded-md border border-slate-200 bg-white px-3">
              <span
                className={`size-2 rounded-full ${autoRefreshEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  {autoRefreshEnabled ? 'Live refresh' : 'Refresh paused'}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {lastUpdatedAt
                    ? `Updated ${lastUpdatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Waiting for data'}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={autoRefreshEnabled}
                onClick={() => setAutoRefreshEnabled((current) => !current)}
              >
                {autoRefreshEnabled ? 'Pause' : 'Resume'}
              </Button>
            </div>
            <Button disabled={isLoading} onClick={() => void loadDashboard()}>
              <RefreshIcon
                className={`size-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              {isLoading ? 'Refreshing...' : 'Refresh data'}
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} onRetry={() => void loadDashboard()} />
        </div>
      ) : null}

      <section aria-labelledby="key-metrics-title" className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="key-metrics-title"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"
          >
            Key metrics
          </h2>
          <p className="hidden text-xs text-slate-400 sm:block">
            Current platform totals
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {primaryMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <AnalyticsIcon className="size-5 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">
                Activity summary
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Current operational distribution.
            </p>
          </div>
          <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
            {activityGroups.map((group) => (
              <div className="px-5 py-4" key={group.label}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {group.label}
                  </h3>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">
                    {group.total}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {group.items.map(([label, value]) => (
                    <div key={label}>
                      <dt className="truncate text-xs text-slate-500">
                        {label}
                      </dt>
                      <dd className="mt-0.5 font-medium text-slate-800 tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-6 grid min-w-0 gap-4 2xl:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent users
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest registered Payflow users.
              </p>
            </div>
            <Link
              href="/users"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              View all users<span className="sr-only"> in user management</span>
              <ArrowUpRightIcon className="size-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                    User
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Role
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-semibold sm:px-6"
                  >
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dashboard?.recentUsers ?? []).map((user) => (
                  <tr className="hover:bg-slate-50/70" key={user.id}>
                    <th
                      scope="row"
                      className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900 sm:px-6"
                    >
                      {user.firstName} {user.lastName ?? ''}
                    </th>
                    <td
                      className="max-w-48 truncate px-4 py-3.5 text-slate-600"
                      title={user.email}
                    >
                      {user.email}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{user.role}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-500 tabular-nums sm:px-6">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))}
                {(dashboard?.recentUsers.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent transactions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest activity across all wallets.
              </p>
            </div>
            <Link
              href="/transactions"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
            >
              View all<span className="sr-only"> transactions</span>
              <ArrowUpRightIcon className="size-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Description
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-semibold sm:px-6"
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(dashboard?.recentTransactions ?? []).map((transaction) => {
                  const details =
                    transaction.reference ??
                    transaction.description ??
                    transaction.walletId ??
                    transaction.sourceWalletId ??
                    '-';
                  return (
                    <tr className="hover:bg-slate-50/70" key={transaction.id}>
                      <th
                        scope="row"
                        className="px-5 py-3.5 font-medium text-slate-900 sm:px-6"
                      >
                        <Link
                          href={`/transactions/${transaction.id}`}
                          className="hover:text-blue-700"
                        >
                          {transaction.type}
                        </Link>
                      </th>
                      <td
                        className="max-w-56 truncate px-4 py-3.5 text-slate-600"
                        title={details}
                      >
                        {details}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums"
                      >
                        {formatTransactionAmount(transaction.amount, transaction.currency)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={transaction.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-500 tabular-nums sm:px-6">
                        {formatDate(transaction.createdAt)}
                      </td>
                    </tr>
                  );
                })}
                {(dashboard?.recentTransactions.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No transactions found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </AdminShell>
  );
}
