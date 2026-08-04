'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  adminAuthenticatedRequest,
  clearAdminSession,
  getStoredAdmin,
  hasValidAdminSession,
} from '../lib/api';

type AnalyticsSummary = {
  totalTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  reversedTransactions: number;

  totalDeposits: number;
  totalWithdrawals: number;
  totalTransfers: number;

  totalDepositAmount: string;
  totalWithdrawalAmount: string;
  totalTransferAmount: string;
  totalVolume: string;

  successRate: number;
  newUsers: number;
  newWallets: number;
};

type TransactionTypeData = {
  type: string;
  count: number;
  amount: string;
};

type TransactionStatusData = {
  status: string;
  count: number;
};

type DailyActivity = {
  date: string;
  deposits: number;
  withdrawals: number;
  transfers: number;
  transactionCount: number;
  depositAmount: string;
  withdrawalAmount: string;
  transferAmount: string;
  transactionVolume: string;
  newUsers: number;
  newWallets: number;
};

type AnalyticsResponse = {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };

  summary: AnalyticsSummary;

  transactionTypes: TransactionTypeData[];

  transactionStatuses: TransactionStatusData[];

  dailyActivity: DailyActivity[];
};

function formatMoney(
  amount: string | number,
): string {
  return Number(amount).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
}

function formatChartDate(
  date: string,
): string {
  return new Date(date).toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
    },
  );
}

export default function AnalyticsPage() {
  const router = useRouter();

  const [days, setDays] =
    useState(7);

  const [analytics, setAnalytics] =
    useState<AnalyticsResponse | null>(
      null,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const loadAnalytics = useCallback(
    async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError('');

        const response =
          await adminAuthenticatedRequest<AnalyticsResponse>(
            `/admin/analytics?days=${days}`,
          );

        setAnalytics(response);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load analytics';

        if (
          message
            .toLowerCase()
            .includes('unauthorized') ||
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
    [
      days,
      router,
    ],
  );

  useEffect(() => {
    if (!hasValidAdminSession()) {
      router.replace('/login');
      return;
    }

    const admin = getStoredAdmin();

    if (!admin) {
      clearAdminSession();
      router.replace('/login');
      return;
    }

    void loadAnalytics();
  }, [
    loadAnalytics,
    router,
  ]);

  const dailyChartData = useMemo(
    () =>
      (analytics?.dailyActivity ?? []).map(
        (item) => ({
          ...item,
          label: formatChartDate(
            item.date,
          ),
          depositAmountNumber:
            Number(item.depositAmount),
          withdrawalAmountNumber:
            Number(item.withdrawalAmount),
          transferAmountNumber:
            Number(item.transferAmount),
          transactionVolumeNumber:
            Number(item.transactionVolume),
        }),
      ),
    [analytics],
  );

  const transactionTypeChartData =
    useMemo(
      () =>
        (
          analytics?.transactionTypes ??
          []
        ).map((item) => ({
          name: item.type,
          value: item.count,
          amount: Number(item.amount),
        })),
      [analytics],
    );

  const transactionStatusChartData =
    useMemo(
      () =>
        (
          analytics?.transactionStatuses ??
          []
        ).map((item) => ({
          name: item.status,
          value: item.count,
        })),
      [analytics],
    );

  function handleLogout(): void {
    clearAdminSession();
    router.push('/login');
    router.refresh();
  }

  const summary = analytics?.summary;

  const cards = [
    {
      title: 'Transactions',
      value: String(
        summary?.totalTransactions ?? 0,
      ),
      description:
        'Transactions in selected period',
      className:
        'bg-sky-500',
    },
    {
      title: 'Total Volume',
      value: `INR ${formatMoney(
        summary?.totalVolume ?? '0',
      )}`,
      description:
        'Combined processed volume',
      className:
        'bg-slate-900',
    },
    {
      title: 'Success Rate',
      value: `${
        summary?.successRate ?? 0
      }%`,
      description: `${
        summary?.completedTransactions ??
        0
      } completed transactions`,
      className:
        'bg-emerald-500',
    },
    {
      title: 'New Users',
      value: String(
        summary?.newUsers ?? 0,
      ),
      description:
        'Users registered in period',
      className:
        'bg-violet-500',
    },
    {
      title: 'New Wallets',
      value: String(
        summary?.newWallets ?? 0,
      ),
      description:
        'Wallets created in period',
      className:
        'bg-amber-500',
    },
  ];

  if (isLoading && !analytics) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="font-semibold text-slate-600">
          Loading analytics...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-sky-600">
              Payflow Admin
            </h1>

            <p className="text-sm text-slate-500">
              Analytics Dashboard
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                router.push('/dashboard')
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() =>
                router.push('/transactions')
              }
              className="rounded-xl border border-violet-500 bg-white px-4 py-2 font-semibold text-violet-600 transition hover:bg-violet-50"
            >
              Transactions
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
              Live analytics
            </p>

            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Payflow performance
            </h2>

            <p className="mt-2 text-slate-600">
              Monitor transaction volume,
              success rate and platform growth.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {[7, 30, 90].map(
              (period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() =>
                    setDays(period)
                  }
                  className={`rounded-xl px-5 py-3 font-semibold transition ${
                    days === period
                      ? 'bg-sky-500 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {period} Days
                </button>
              ),
            )}

            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                void loadAnalytics()
              }
              className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isLoading
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <article
              key={card.title}
              className={`${card.className} rounded-2xl p-6 text-white shadow-lg`}
            >
              <p className="text-sm text-white/75">
                {card.title}
              </p>

              <p className="mt-3 text-2xl font-bold">
                {card.value}
              </p>

              <p className="mt-2 text-sm text-white/75">
                {card.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Deposits
            </p>

            <p className="mt-3 text-2xl font-bold text-emerald-600">
              INR{' '}
              {formatMoney(
                summary?.totalDepositAmount ??
                  '0',
              )}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {summary?.totalDeposits ?? 0}{' '}
              transactions
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Withdrawals
            </p>

            <p className="mt-3 text-2xl font-bold text-red-600">
              INR{' '}
              {formatMoney(
                summary?.totalWithdrawalAmount ??
                  '0',
              )}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {summary?.totalWithdrawals ??
                0}{' '}
              transactions
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Transfers
            </p>

            <p className="mt-3 text-2xl font-bold text-violet-600">
              INR{' '}
              {formatMoney(
                summary?.totalTransferAmount ??
                  '0',
              )}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {summary?.totalTransfers ?? 0}{' '}
              transactions
            </p>
          </article>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Daily transaction volume
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Combined deposit, withdrawal and
              transfer amount.
            </p>

            <div className="mt-6 h-80">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={dailyChartData}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis dataKey="label" />

                  <YAxis />

                  <Tooltip
                    formatter={(value) =>
                      `INR ${formatMoney(
                        Number(value ?? 0),
                      )}`
                    }
                  />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="transactionVolumeNumber"
                    name="Volume"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Daily transaction count
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Deposits, withdrawals and
              transfers per day.
            </p>

            <div className="mt-6 h-80">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={dailyChartData}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis dataKey="label" />

                  <YAxis />

                  <Tooltip />

                  <Legend />

                  <Bar
                    dataKey="deposits"
                    name="Deposits"
                  />

                  <Bar
                    dataKey="withdrawals"
                    name="Withdrawals"
                  />

                  <Bar
                    dataKey="transfers"
                    name="Transfers"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Transaction types
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Distribution by transaction type.
            </p>

            <div className="mt-6 h-80">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>
                  <Pie
                    data={
                      transactionTypeChartData
                    }
                    dataKey="value"
                    nameKey="name"
                    outerRadius={105}
                    label
                  >
                    {transactionTypeChartData.map(
                      (item) => (
                        <Cell
                          key={item.name}
                        />
                      ),
                    )}
                  </Pie>

                  <Tooltip />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Transaction statuses
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Completed, failed, pending and
              reversed transactions.
            </p>

            <div className="mt-6 h-80">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={
                    transactionStatusChartData
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis dataKey="name" />

                  <YAxis />

                  <Tooltip />

                  <Bar
                    dataKey="value"
                    name="Transactions"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              User growth
            </h3>

            <div className="mt-6 h-72">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={dailyChartData}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis dataKey="label" />

                  <YAxis />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="newUsers"
                    name="New users"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">
              Wallet growth
            </h3>

            <div className="mt-6 h-72">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={dailyChartData}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis dataKey="label" />

                  <YAxis />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="newWallets"
                    name="New wallets"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}