'use client';

import {
  useCallback,
  useEffect,
  useRef,
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
  userAuthenticatedRequest,
} from '../lib/api';
import { formatMoney as formatExactMoney } from '../lib/money';
import { beginLatestRequest, isLatestRequest } from '../lib/request-sequencing';

import {
  useNotifications,
} from '../hooks/use-notifications';

import SummaryCards from './components/SummaryCards';
import { EmptyState, ErrorState, PageContainer, PageHeader, StatusBadge } from '../components/customer';

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
  return formatExactMoney(String(amount), currency);
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
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);

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
  const [wallets, setWallets] = useState<UserWallet[]>([]);

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
        const request = beginLatestRequest(requestRef);
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
              { signal: request.controller.signal },
            );

          let resolvedWallets: UserWallet[] = [];

          if (
            Array.isArray(
              walletResponse,
            )
          ) {
            resolvedWallets = walletResponse;
          }
          else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'id' in walletResponse
          ) {
            resolvedWallets = [walletResponse as UserWallet];
          }
          else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'data' in walletResponse
          ) {
            resolvedWallets = walletResponse.data ? [walletResponse.data] : [];
          }
          else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'wallets' in
              walletResponse
          ) {
            resolvedWallets = walletResponse.wallets ?? [];
          }

          const resolvedWallet = resolvedWallets[0] ?? null;

          if (
            !resolvedWallet?.id
          ) {
            throw new Error(
              'Wallet details were missing from the server response',
            );
          }

          if (!isLatestRequest(requestRef, request)) return;

          setWallet(
            resolvedWallet,
          );
          setWallets(resolvedWallets);

          const historyResponses = await Promise.all(resolvedWallets.map((currentWallet) =>
            userAuthenticatedRequest<
              | DashboardTransaction[]
              | DashboardTransactionResponse
            >(
              `/wallets/${currentWallet.id}/transactions?page=1&limit=100&type=ALL`,
              { signal: request.controller.signal },
            )));

          if (!isLatestRequest(requestRef, request)) return;

          const resolvedTransactions = historyResponses.flatMap((historyResponse) => {
            if (Array.isArray(historyResponse)) return historyResponse;
            return historyResponse.transactions ?? historyResponse.items ?? historyResponse.data ?? [];
          }).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

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
          if (!isLatestRequest(requestRef, request)) return;
          setError(
            requestError instanceof
              Error
              ? requestError.message
              : 'Unable to load wallet',
          );
        }
        finally {
          if (requestRef.current?.id === request.id) {
            setIsLoading(false);
            setIsRefreshing(false);
          }
        }
      },
      [
        router,
      ],
    );

  useEffect(() => {
    void loadDashboard();
    return () => requestRef.current?.controller.abort();
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

  return (
    <main>
      <PageContainer>
        <PageHeader
          eyebrow="Overview"
          title={`Welcome back, ${user?.firstName || 'Customer'}`}
          description="Your balances, recent activity and everyday payment actions in one place."
          actions={<>
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
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {isRefreshing
                ? 'Refreshing...'
                : 'Refresh balance'}
            </button>

          </>}
        />

        <nav aria-label="Quick actions" className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Send', '/send-money', 'Pay a verified recipient'],
            ['Receive', '/receive', 'Share your payment address'],
            ['Scan / Pay', '/scan', 'Scan a Payflow payment QR'],
            ['Deposit', '/deposit', 'Add money to a wallet'],
            ['Withdraw', '/withdraw', 'Move money out safely'],
            ['Rewards', '/rewards', 'View available rewards'],
          ].map(([label, href, description]) => <Link key={label} href={href} className="group min-h-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-600"><span className="font-bold text-slate-950 group-hover:text-blue-700">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></Link>)}
        </nav>

        <section aria-labelledby="everyday-payflow" className="mt-8">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Everyday Payflow</p><h2 id="everyday-payflow" className="mt-1 text-xl font-bold text-slate-950">Payments, people and services</h2><p className="mt-2 text-sm text-slate-600">Open a supported flow directly. Provider-dependent services are clearly labelled before you submit.</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              ['Request money', '/request-money', 'Create, accept or decline requests'], ['Contacts', '/contacts', 'Manage trusted recipients'], ['Split bill', '/split-bill', 'Track exact participant shares'], ['Recharge', '/recharge', 'Provider-backed mobile recharge'],
              ['Bills', '/bills', 'Validate and track bill attempts'], ['AutoPay', '/autopay', 'Manage mandate consent and status'], ['Offers', '/offers', 'Browse and claim eligible offers'], ['Rewards', '/rewards', 'Review earned rewards'],
              ['Insights', '/insights', 'Currency-separated activity summaries'], ['Notifications', '/notifications', 'Unread and real-time account updates'], ['Help & disputes', '/help', 'Open and track support cases'], ['All services', '/services', 'See the complete capability catalogue'],
            ].map(([label, href, description]) => <Link key={href} href={href} className="min-h-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-600"><span className="font-bold text-slate-950">{label}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{description}</span></Link>)}
          </div>
        </section>

        {error ? (
          <div className="mt-6"><ErrorState message={error} onRetry={() => void loadDashboard(false)} /></div>
        ) : null}

        <section id="wallets" aria-labelledby="wallet-heading" className="mt-8">
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Wallets</p><h2 id="wallet-heading" className="mt-1 text-xl font-bold text-slate-950">Available balances</h2></div><span className="text-sm text-slate-500">Never combined across currencies</span></div>
          {wallets.length === 0 && !isLoading ? <EmptyState title="No wallets available" description="Your wallets will appear here after they are created." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{wallets.map((currentWallet) => <article key={currentWallet.id} className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-sm font-semibold text-slate-300">
                  Available balance
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight">
                  {isLoading
                    ? 'Loading...'
                    : formatMoney(
                        currentWallet.balance,
                        currentWallet.currency,
                      )}
                </p>

                <p className="mt-4 break-all text-xs text-slate-400">
                  Wallet · {currentWallet.id}
                </p>
              </div>

              <StatusBadge status={currentWallet.status} />
            </div>
          </article>)}</div>}

          <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
              className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-600"
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
      </PageContainer>
    </main>
  );
}






