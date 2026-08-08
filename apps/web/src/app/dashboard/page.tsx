'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import type {
  PayflowUser,
} from '@payflow/shared-types';

import {
  getStoredUser,
  hasValidUserSession,
  logoutUser,
  userAuthenticatedRequest,
} from '../lib/api';

import {
  useNotifications,
} from '../hooks/use-notifications';

import DashboardHeader from './components/DashboardHeader';
import SummaryCards from './components/SummaryCards';
import TransactionChart from './components/TransactionChart';

type UserWallet = {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  status:
    | 'ACTIVE'
    | 'FROZEN'
    | 'CLOSED';
  version: number;
  createdAt: string;
  updatedAt: string;
};

type DashboardTransaction = {
  id: string;
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'TRANSFER';
  direction:
    | 'CREDIT'
    | 'DEBIT';
  amount: string;
  currency: string;
  status: string;
  reference?: string | null;
  description?: string | null;
  createdAt: string;
  sourceWalletId?: string | null;
  destinationWalletId?: string | null;
  counterparty?: {
    walletId: string;
    userId: string;
    firstName: string;
    lastName?: string | null;
    email: string;
  } | null;
};

type DashboardTransactionResponse = {
  transactions?: DashboardTransaction[];
  items?: DashboardTransaction[];
  data?: DashboardTransaction[];
};

function formatMoney(
  amount: string | number,
  currency = 'INR',
): string {
  const value =
    Number(amount);

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        2,
    },
  ).format(
    Number.isFinite(value)
      ? value
      : 0,
  );
}

function formatDateTime(
  value: Date | null,
): string {
  if (!value) {
    return 'Not updated yet';
  }

  return value.toLocaleString(
    'en-IN',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  );
}

export default function UserDashboardPage() {
  const router =
    useRouter();

  const {
    latestNotification,
    isConnected,
  } = useNotifications();

  const [
    user,
    setUser,
  ] = useState<PayflowUser | null>(
    null,
  );

  const [
    wallet,
    setWallet,
  ] = useState<UserWallet | null>(
    null,
  );

  const [
    recentTransactions,
    setRecentTransactions,
  ] = useState<DashboardTransaction[]>(
    [],
  );

  const [
    analyticsTransactions,
    setAnalyticsTransactions,
  ] = useState<DashboardTransaction[]>(
    [],
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] = useState<Date | null>(
    null,
  );

  const loadDashboard =
    useCallback(
      async (
        showLoader = true,
      ): Promise<void> => {
        const storedUser =
          getStoredUser();

        if (
          !storedUser ||
          !hasValidUserSession()
        ) {
          router.replace(
            '/login',
          );

          return;
        }

        setUser(
          storedUser,
        );

        if (showLoader) {
          setIsLoading(true);
        }
        else {
          setIsRefreshing(true);
        }

        setError('');

        try {
          const walletResponse =
            await userAuthenticatedRequest<
              | UserWallet
              | UserWallet[]
              | {
                  data?: UserWallet;
                  wallets?: UserWallet[];
                }
            >(
              `/wallets/user/${storedUser.id}`,
            );

          let resolvedWallet:
            | UserWallet
            | null = null;

          if (
            Array.isArray(
              walletResponse,
            )
          ) {
            resolvedWallet =
              walletResponse[0] ??
              null;
          }
          else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'id' in walletResponse
          ) {
            resolvedWallet =
              walletResponse as
                UserWallet;
          }
          else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'data' in walletResponse
          ) {
            resolvedWallet =
              walletResponse.data ??
              null;
          }
          else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'wallets' in
              walletResponse
          ) {
            resolvedWallet =
              walletResponse
                .wallets?.[0] ??
              null;
          }

          if (
            !resolvedWallet?.id
          ) {
            throw new Error(
              'Wallet details were missing from the server response',
            );
          }

          setWallet(
            resolvedWallet,
          );

          const historyResponse =
            await userAuthenticatedRequest<
              | DashboardTransaction[]
              | DashboardTransactionResponse
            >(
              `/wallets/${resolvedWallet.id}/transactions?page=1&limit=100&type=ALL`,
            );

          let resolvedTransactions:
            DashboardTransaction[] = [];

          if (
            Array.isArray(
              historyResponse,
            )
          ) {
            resolvedTransactions =
              historyResponse;
          }
          else if (
            historyResponse.transactions
          ) {
            resolvedTransactions =
              historyResponse.transactions;
          }
          else if (
            historyResponse.items
          ) {
            resolvedTransactions =
              historyResponse.items;
          }
          else if (
            historyResponse.data
          ) {
            resolvedTransactions =
              historyResponse.data;
          }

          setAnalyticsTransactions(
            resolvedTransactions,
          );

          setRecentTransactions(
            resolvedTransactions.slice(
              0,
              5,
            ),
          );

          setLastUpdatedAt(
            new Date(),
          );
        }
        catch (
          requestError
        ) {
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : 'Unable to load wallet',
          );
        }
        finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      },
      [
        router,
      ],
    );

  useEffect(() => {
    void loadDashboard();
  }, [
    loadDashboard,
  ]);

  useEffect(() => {
    if (
      !latestNotification
    ) {
      return;
    }

    const walletEvents = [
      'wallet.deposit.completed',
      'wallet.withdrawal.completed',
      'wallet.transfer.completed',
      'payment.completed',
    ];

    if (
      walletEvents.includes(
        latestNotification.type,
      )
    ) {
      void loadDashboard(
        false,
      );
    }
  }, [
    latestNotification,
    loadDashboard,
  ]);

  async function handleLogout():
    Promise<void> {
    await logoutUser();

    router.replace(
      '/login',
    );

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <DashboardHeader
        firstName={
          user?.firstName
        }
        lastName={
          user?.lastName
        }
        email={
          user?.email
        }
        onLogout={
          handleLogout
        }
      />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-sky-600">
              Wallet Dashboard 2.0
            </p>

            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Welcome back,
              {' '}
              {user?.firstName ??
                'Payflow User'}
            </h2>

            <p className="mt-2 text-slate-600">
              Manage your wallet, security and transactions.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={
                isRefreshing
              }
              onClick={() =>
                void loadDashboard(
                  false,
                )
              }
              className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefreshing
                ? 'Refreshing...'
                : 'Refresh balance'}
            </button>

            <Link
              href="/transactions"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Transactions
            </Link>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 p-7 text-white shadow-xl lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-sm font-semibold text-sky-100">
                  Available balance
                </p>

                <p className="mt-3 text-4xl font-bold">
                  {isLoading
                    ? 'Loading...'
                    : formatMoney(
                        wallet?.balance ??
                          0,
                        wallet?.currency ??
                          'INR',
                      )}
                </p>

                <p className="mt-4 text-sm text-sky-100">
                  Wallet ID:
                  {' '}
                  {wallet?.id ??
                    'Unavailable'}
                </p>
              </div>

              <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-bold">
                {wallet?.status ??
                  'UNKNOWN'}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/transactions"
                className="rounded-xl bg-white px-5 py-3 font-bold text-sky-700 transition hover:bg-sky-50"
              >
                View activity
              </Link>

              <Link
                href="/edit-profile"
                className="rounded-xl border border-white/50 px-5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Manage profile
              </Link>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Live status
            </p>

            <div className="mt-5 flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  isConnected
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
                }`}
              />

              <p className="font-bold text-slate-900">
                {isConnected
                  ? 'Real-time connected'
                  : 'Real-time disconnected'}
              </p>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-500">
              Wallet balance will automatically refresh after deposits, withdrawals, transfers and payments.
            </p>

            <p className="mt-5 text-xs font-semibold text-slate-400">
              Last updated
            </p>

            <p className="mt-1 font-semibold text-slate-700">
              {formatDateTime(
                lastUpdatedAt,
              )}
            </p>
          </article>
        </section>

        <section className="mt-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-sky-600">
              Wallet analytics
            </p>

            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              Financial overview
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Money movement across your recent Payflow wallet activity.
            </p>
          </div>

          <div className="mt-5">
            <SummaryCards
              wallets={wallet ? [wallet] : []}
              transactions={analyticsTransactions}
            />
          </div>

          <div className="mt-6">
            <TransactionChart
              transactions={analyticsTransactions}
            />
          </div>
        </section>

        <section className="mt-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-sky-600">
              Quick access
            </p>

            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              Manage your Payflow account
            </h3>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/transactions"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-lg font-bold text-slate-900">
                Transactions
              </p>

              <p className="mt-2 text-sm text-slate-500">
                View wallet activity and payment history.
              </p>
            </Link>

            <Link
              href="/sessions"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-lg font-bold text-slate-900">
                Active devices
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Review and manage signed-in devices.
              </p>
            </Link>

            <Link
              href="/edit-profile"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-lg font-bold text-slate-900">
                Profile
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Update your personal account information.
              </p>
            </Link>

            <Link
              href="/notification-settings"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-lg font-bold text-slate-900">
                Notification Settings
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Choose how Payflow notifies you about wallet activity.
              </p>
            </Link>

            <Link
              href="/forgot-password"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <p className="text-lg font-bold text-slate-900">
                Security
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Reset your password and protect your account.
              </p>
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-sky-600">
                Recent activity
              </p>

              <h3 className="mt-2 text-2xl font-bold text-slate-900">
                Recent Transactions
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your latest wallet activity.
              </p>
            </div>

            <Link
              href="/transactions"
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              View All Transactions
            </Link>
          </div>

          {isLoading ? (
            <p className="mt-6 text-slate-500">
              Loading recent transactions...
            </p>
          ) : recentTransactions.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-8 text-center text-slate-500">
              No recent transactions found.
            </div>
          ) : (
            <div className="mt-6 divide-y divide-slate-100">
              {recentTransactions.map(
                (transaction) => {
                  const isCredit =
                    transaction.direction ===
                    'CREDIT';

                  const counterpartyName =
                    transaction.counterparty
                      ? `${transaction.counterparty.firstName} ${
                          transaction.counterparty.lastName ?? ''
                        }`.trim()
                      : '';

                  const details =
                    transaction.type ===
                      'TRANSFER' &&
                    transaction.counterparty
                      ? `${
                          isCredit
                            ? 'Received from'
                            : 'Sent to'
                        } ${counterpartyName}`
                      : transaction.description ??
                        transaction.reference ??
                        'Payflow transaction';

                  return (
                    <Link
                      key={transaction.id}
                      href={`/transactions?transactionId=${encodeURIComponent(
                        transaction.id,
                      )}`}
                      className="flex flex-col gap-4 py-5 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                            {transaction.type}
                          </span>

                          <span className="text-xs font-semibold text-slate-400">
                            {new Date(
                              transaction.createdAt,
                            ).toLocaleString(
                              'en-IN',
                            )}
                          </span>
                        </div>

                        <p className="mt-2 font-bold text-slate-900">
                          {details}
                        </p>

                        {transaction.counterparty && (
                          <p className="mt-1 text-sm text-slate-500">
                            {transaction.counterparty.email}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 sm:text-right">
                        <div>
                          <p
                            className={
                              isCredit
                                ? 'text-lg font-bold text-emerald-600'
                                : 'text-lg font-bold text-red-600'
                            }
                          >
                            {isCredit
                              ? '+'
                              : '-'}
                            {formatMoney(
                              transaction.amount,
                              transaction.currency,
                            )}
                          </p>

                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {transaction.status}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                },
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">
            Wallet information
          </h3>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm text-slate-500">
                Currency
              </p>

              <p className="mt-1 font-bold text-slate-900">
                {wallet?.currency ??
                  'INR'}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Wallet status
              </p>

              <p className="mt-1 font-bold text-slate-900">
                {wallet?.status ??
                  'Unknown'}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Wallet version
              </p>

              <p className="mt-1 font-bold text-slate-900">
                {wallet?.version ??
                  0}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Last wallet update
              </p>

              <p className="mt-1 font-bold text-slate-900">
                {wallet?.updatedAt
                  ? new Date(
                      wallet.updatedAt,
                    ).toLocaleString(
                      'en-IN',
                    )
                  : 'Unavailable'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}




