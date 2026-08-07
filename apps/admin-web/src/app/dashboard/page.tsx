'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  AdminUser,
  adminAuthenticatedRequest,
  clearAdminSession,
  getStoredAdmin,
  hasValidAdminSession,
} from '../lib/api';

type DashboardStats = {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  suspendedUsers: number;

  totalWallets: number;
  activeWallets: number;
  frozenWallets: number;
  closedWallets: number;

  totalTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalTransfers: number;

  totalBalance: string;
  totalDepositAmount: string;
  totalWithdrawalAmount: string;
  totalTransferAmount: string;
};

type RecentUser = {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  role: string;
  status: string;
  createdAt: string;
};

type RecentTransaction = {
  id: string;
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'TRANSFER';
  amount: string;
  currency: string;
  status: string;
  reference?: string | null;
  description?: string | null;
  walletId?: string | null;
  sourceWalletId?: string | null;
  destinationWalletId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

type AdminDashboardResponse = {
  stats: DashboardStats;
  recentUsers: RecentUser[];
  recentTransactions: RecentTransaction[];
};

function formatMoney(
  amount: string,
): string {
  return Number(amount).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [admin, setAdmin] =
    useState<AdminUser | null>(null);

  const [dashboard, setDashboard] =
    useState<AdminDashboardResponse | null>(
      null,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    autoRefreshEnabled,
    setAutoRefreshEnabled,
  ] = useState(true);

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] = useState<Date | null>(
    null,
  );

  const [error, setError] = useState('');

  const loadDashboard = useCallback(
    async (): Promise<void> => {
      try {
        setError('');
        setIsLoading(true);

        const response =
          await adminAuthenticatedRequest<AdminDashboardResponse>(
            '/admin/dashboard',
          );

        setDashboard(response);

        setLastUpdatedAt(
          new Date(),
        );
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load admin dashboard';

        if (
          message
            .toLowerCase()
            .includes('session')
        ) {
          clearAdminSession();
          router.replace('/login');
          return;
        }

        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!hasValidAdminSession()) {
      router.replace('/login');
      return;
    }

    const storedAdmin = getStoredAdmin();

    if (!storedAdmin) {
      clearAdminSession();
      router.replace('/login');
      return;
    }

    setAdmin(storedAdmin);

    void loadDashboard();
  }, [loadDashboard, router]);
  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const intervalId =
      window.setInterval(() => {
        void loadDashboard();
      }, 10_000);

    return () => {
      window.clearInterval(
        intervalId,
      );
    };
  }, [
    autoRefreshEnabled,
    loadDashboard,
  ]);


  function handleLogout(): void {
    clearAdminSession();
    router.push('/login');
    router.refresh();
  }

  if (!admin || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="font-semibold text-slate-600">
          Loading admin dashboard...
        </p>
      </main>
    );
  }

  const stats = dashboard?.stats;

  const cards = [
    {
      title: 'Total Users',
      value: String(
        stats?.totalUsers ?? 0,
      ),
      description: `${
        stats?.activeUsers ?? 0
      } active users`,
      style: 'bg-sky-500',
    },
    {
      title: 'Total Wallets',
      value: String(
        stats?.totalWallets ?? 0,
      ),
      description: `${
        stats?.activeWallets ?? 0
      } active wallets`,
      style: 'bg-emerald-500',
    },
    {
      title: 'Transactions',
      value: String(
        stats?.totalTransactions ?? 0,
      ),
      description: `${
        stats?.totalDeposits ?? 0
      } deposits, ${
        stats?.totalTransfers ?? 0
      } transfers`,
      style: 'bg-violet-500',
    },
    {
      title: 'System Balance',
      value: `INR ${formatMoney(
        stats?.totalBalance ?? '0',
      )}`,
      description:
        'Combined wallet balance',
      style: 'bg-slate-900',
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-sky-600">
              Payflow Admin
            </h1>

            <p className="text-sm text-slate-500">
              Administration Dashboard
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="font-semibold text-slate-900">
                {admin.firstName}{' '}
                {admin.lastName ?? ''}
              </p>

              <p className="text-sm text-slate-500">
                {admin.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
              Admin overview
            </p>

            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Welcome, {admin.firstName}
            </h2>

            <p className="mt-2 text-slate-600">
              Live Payflow system statistics from
              PostgreSQL.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                router.push('/users')
              }
              className="rounded-xl border border-sky-500 bg-white px-5 py-3 font-semibold text-sky-600 transition hover:bg-sky-50"
            >
              Manage users
            </button>

            <button
              type="button"
              onClick={() =>
                router.push('/wallets')
              }
              className="rounded-xl border border-emerald-500 bg-white px-5 py-3 font-semibold text-emerald-600 transition hover:bg-emerald-50"
            >
              Manage wallets
            </button>

            <button
              type="button"
              onClick={() =>
                router.push('/transactions')
              }
              className="rounded-xl border border-violet-500 bg-white px-5 py-3 font-semibold text-violet-600 transition hover:bg-violet-50"
            >
              Manage transactions
            </button>

            <button
              type="button"
              onClick={() =>
                router.push('/analytics')
              }
              className="rounded-xl border border-amber-500 bg-white px-5 py-3 font-semibold text-amber-600 transition hover:bg-amber-50"
            >
              View analytics
            </button>

            <button
              type="button"
              onClick={() =>
                router.push('/audit-logs')
              }
              className="rounded-xl border border-red-500 bg-white px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50"
            >
              View audit logs
            </button>            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  autoRefreshEnabled
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
                }`}
              />

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Live refresh
                </p>

                <p className="text-xs text-slate-500">
                  {lastUpdatedAt
                    ? `Updated ${lastUpdatedAt.toLocaleTimeString(
                        'en-IN',
                      )}`
                    : 'Waiting for data'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setAutoRefreshEnabled(
                    (current) =>
                      !current,
                  )
                }
                className="ml-2 rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {autoRefreshEnabled
                  ? 'Pause'
                  : 'Resume'}
              </button>
            </div>



            <button
              type="button"
              onClick={() =>
                void loadDashboard()
              }
              className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-600"
            >
              Refresh data
            </button>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((stat) => (
            <article
              key={stat.title}
              className={`${stat.style} rounded-2xl p-6 text-white shadow-lg`}
            >
              <p className="text-sm text-white/75">
                {stat.title}
              </p>

              <p className="mt-3 text-3xl font-bold">
                {stat.value}
              </p>

              <p className="mt-2 text-sm text-white/75">
                {stat.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Deposited amount
            </p>

            <p className="mt-3 text-2xl font-bold text-emerald-600">
              INR{' '}
              {formatMoney(
                stats?.totalDepositAmount ??
                  '0',
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Withdrawn amount
            </p>

            <p className="mt-3 text-2xl font-bold text-red-600">
              INR{' '}
              {formatMoney(
                stats?.totalWithdrawalAmount ??
                  '0',
              )}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Transferred amount
            </p>

            <p className="mt-3 text-2xl font-bold text-violet-600">
              INR{' '}
              {formatMoney(
                stats?.totalTransferAmount ??
                  '0',
              )}
            </p>
          </article>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Recent users
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Latest registered Payflow users.
            </p>

            <div className="mt-6 space-y-4">
              {(dashboard?.recentUsers ?? []).map(
                (recentUser) => (
                  <div
                    key={recentUser.id}
                    className="rounded-xl bg-slate-50 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {
                            recentUser.firstName
                          }{' '}
                          {recentUser.lastName ??
                            ''}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {recentUser.email}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(
                            recentUser.createdAt,
                          ).toLocaleString(
                            'en-IN',
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                          {recentUser.role}
                        </span>

                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          {recentUser.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ),
              )}

              {(dashboard?.recentUsers.length ??
                0) === 0 ? (
                <p className="rounded-xl bg-slate-50 p-6 text-center text-slate-500">
                  No users found.
                </p>
              ) : null}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Recent transactions
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Latest activity across all wallets.
            </p>

            <div className="mt-6 space-y-4">
              {(
                dashboard?.recentTransactions ??
                []
              ).map((transaction) => {
                const isDeposit =
                  transaction.type ===
                  'DEPOSIT';

                const details =
                  transaction.reference ??
                  transaction.description ??
                  transaction.walletId ??
                  transaction.sourceWalletId ??
                  '-';

                return (
                  <div
                    key={transaction.id}
                    className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {transaction.type}
                      </p>

                      <p className="mt-1 max-w-xs break-all text-sm text-slate-500">
                        {details}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(
                          transaction.createdAt,
                        ).toLocaleString(
                          'en-IN',
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          isDeposit
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {isDeposit ? '+' : '-'}
                        {transaction.currency}{' '}
                        {formatMoney(
                          transaction.amount,
                        )}
                      </p>

                      <span className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        {transaction.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {(dashboard?.recentTransactions
                .length ?? 0) === 0 ? (
                <p className="rounded-xl bg-slate-50 p-6 text-center text-slate-500">
                  No transactions found.
                </p>
              ) : null}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}