'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Link from 'next/link';

import jsPDF from 'jspdf';

import {
  useRouter,
} from 'next/navigation';

import {
  getStoredUser,
  hasValidUserSession,
  userAuthenticatedRequest,
} from '../lib/api';

type UserWallet = {
  id: string;
  userId: string;
  balance: string;
  currency: string;
  status: string;
};

type WalletTransaction = {
  id: string;
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'TRANSFER';
  status:
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'REVERSED';
  amount: string;
  currency: string;
  reference?: string | null;
  description?: string | null;
  createdAt: string;
  completedAt?: string | null;
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

type TransactionHistoryResponse = {
  items?: WalletTransaction[];
  transactions?: WalletTransaction[];
  data?: WalletTransaction[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

function formatMoney(
  amount: string | number,
  currency = 'INR',
): string {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    },
  ).format(Number(amount) || 0);
}

function getTransactionSign(
  transaction: WalletTransaction,
  walletId: string,
): string {
  if (
    transaction.type === 'WITHDRAWAL'
  ) {
    return '-';
  }

  if (
    transaction.type === 'TRANSFER' &&
    transaction.sourceWalletId ===
      walletId
  ) {
    return '-';
  }

  return '+';
}

export default function TransactionsPage() {
  const router = useRouter();

  const [wallet, setWallet] =
    useState<UserWallet | null>(null);

  const [
    transactions,
    setTransactions,
  ] = useState<WalletTransaction[]>([]);

  const [selectedTransaction, setSelectedTransaction] =
    useState<WalletTransaction | null>(null);

  const [filter, setFilter] =
    useState<
      | 'ALL'
      | 'DEPOSIT'
      | 'WITHDRAWAL'
      | 'TRANSFER'
    >('ALL');

  const [search, setSearch] =
    useState('');

  const [fromDate, setFromDate] =
    useState('');

  const [toDate, setToDate] =
    useState('');

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const loadTransactions =
    useCallback(
      async (): Promise<void> => {
        const user =
          getStoredUser();

        if (
          !user ||
          !hasValidUserSession()
        ) {
          router.replace('/login');
          return;
        }

        try {
          setIsLoading(true);
          setError('');

          const walletResponse =
            await userAuthenticatedRequest<
              | UserWallet
              | UserWallet[]
              | {
                  data?: UserWallet;
                  wallets?: UserWallet[];
                }
            >(
              `/wallets/user/${user.id}`,
            );

          let resolvedWallet:
            | UserWallet
            | null = null;

          if (
            Array.isArray(walletResponse)
          ) {
            resolvedWallet =
              walletResponse[0] ?? null;
          } else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'id' in walletResponse
          ) {
            resolvedWallet =
              walletResponse as UserWallet;
          } else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'data' in walletResponse
          ) {
            resolvedWallet =
              walletResponse.data ?? null;
          } else if (
            walletResponse &&
            typeof walletResponse ===
              'object' &&
            'wallets' in walletResponse
          ) {
            resolvedWallet =
              walletResponse.wallets?.[0] ??
              null;
          }

          if (!resolvedWallet?.id) {
            throw new Error(
              'Wallet details were not found',
            );
          }

          setWallet(resolvedWallet);

          const historyResponse =
            await userAuthenticatedRequest<
              | WalletTransaction[]
              | TransactionHistoryResponse
            >(
              `/wallets/${resolvedWallet.id}/transactions?page=1&limit=100&type=ALL`,
            );

          let resolvedTransactions:
            WalletTransaction[] = [];

          if (
            Array.isArray(historyResponse)
          ) {
            resolvedTransactions =
              historyResponse;
          } else if (
            historyResponse.items
          ) {
            resolvedTransactions =
              historyResponse.items;
          } else if (
            historyResponse.transactions
          ) {
            resolvedTransactions =
              historyResponse.transactions;
          } else if (
            historyResponse.data
          ) {
            resolvedTransactions =
              historyResponse.data;
          }

          setTransactions(
            resolvedTransactions,
          );
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load transactions',
          );
        } finally {
          setIsLoading(false);
        }
      },
      [router],
    );

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      transactions.length === 0
    ) {
      return;
    }

    const transactionId =
      new URLSearchParams(
        window.location.search,
      ).get('transactionId');

    if (!transactionId) {
      return;
    }

    const requestedTransaction =
      transactions.find(
        (transaction) =>
          transaction.id ===
          transactionId,
      );

    if (requestedTransaction) {
      setSelectedTransaction(
        requestedTransaction,
      );
    }
  }, [transactions]);

  const filteredTransactions =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return transactions.filter(
        (transaction) => {
          if (
            filter !== 'ALL' &&
            transaction.type !== filter
          ) {
            return false;
          }

          if (normalizedSearch) {
            const counterpartyName =
              transaction.counterparty
                ? `${transaction.counterparty.firstName} ${
                    transaction.counterparty.lastName ?? ''
                  }`
                : '';

            const searchableText = [
              transaction.id,
              transaction.type,
              transaction.status,
              transaction.description ?? '',
              transaction.reference ?? '',
              transaction.counterparty?.email ?? '',
              counterpartyName,
            ]
              .join(' ')
              .toLowerCase();

            if (
              !searchableText.includes(
                normalizedSearch,
              )
            ) {
              return false;
            }
          }

          const transactionDate =
            new Date(transaction.createdAt);

          if (fromDate) {
            const from =
              new Date(`${fromDate}T00:00:00`);

            if (transactionDate < from) {
              return false;
            }
          }

          if (toDate) {
            const to =
              new Date(`${toDate}T23:59:59.999`);

            if (transactionDate > to) {
              return false;
            }
          }

          return true;
        },
      );
    }, [
      filter,
      fromDate,
      search,
      toDate,
      transactions,
    ]);

  const [currentPage, setCurrentPage] =
  useState(1);

const pageSize = 5;

const totalPages = Math.max(
  1,
  Math.ceil(
    filteredTransactions.length /
      pageSize,
  ),
);

const paginatedTransactions =
  useMemo(() => {
    const start =
      (currentPage - 1) *
      pageSize;

    return filteredTransactions.slice(
      start,
      start + pageSize,
    );
  }, [
    currentPage,
    filteredTransactions,
  ]);

useEffect(() => {
  setCurrentPage(1);
}, [
  filter,
  search,
  fromDate,
  toDate,
]);

useEffect(() => {
  if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
}, [
  currentPage,
  totalPages,
]);

const downloadReceipt = (
    transaction: WalletTransaction,
  ): void => {
    const pdf = new jsPDF();

    const counterpartyName =
      transaction.counterparty
        ? `${transaction.counterparty.firstName} ${
            transaction.counterparty.lastName ?? ''
          }`.trim()
        : '';

    const transferDirection =
      wallet &&
      transaction.type === 'TRANSFER'
        ? transaction.sourceWalletId === wallet.id
          ? 'Sent To'
          : 'Received From'
        : '';

    let y = 22;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('PAYFLOW', 20, y);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      'Secure Digital Payments',
      20,
      y + 6,
    );

    pdf.setDrawColor(220);
    pdf.line(20, y + 12, 190, y + 12);

    y += 25;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.text(
      'Transaction Receipt',
      20,
      y,
    );

    y += 12;

    pdf.setFontSize(26);
    pdf.text(
      formatMoney(
        transaction.amount,
        transaction.currency,
      ),
      20,
      y,
    );

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(
      transaction.status,
      160,
      y,
    );

    y += 14;

    pdf.setDrawColor(235);
    pdf.line(20, y, 190, y);

    y += 10;

    const addRow = (
      label: string,
      value: string,
    ): void => {
      pdf.setFontSize(9);
      pdf.setFont(
        'helvetica',
        'bold',
      );
      pdf.text(
        label.toUpperCase(),
        20,
        y,
      );

      pdf.setFontSize(10);
      pdf.setFont(
        'helvetica',
        'normal',
      );

      const wrapped =
        pdf.splitTextToSize(
          value || '—',
          110,
        );

      pdf.text(
        wrapped,
        72,
        y,
      );

      y += Math.max(
        9,
        wrapped.length * 6,
      );
    };

    addRow(
      'Type',
      transaction.type,
    );

    addRow(
      'Transaction ID',
      transaction.id,
    );

    addRow(
      'Created At',
      new Date(
        transaction.createdAt,
      ).toLocaleString('en-IN'),
    );

    addRow(
      'Reference',
      transaction.reference ?? '—',
    );

    addRow(
      'Description',
      transaction.description ?? '—',
    );

    if (
      transaction.type === 'TRANSFER' &&
      transaction.counterparty
    ) {
      pdf.setDrawColor(235);
      pdf.line(
        20,
        y,
        190,
        y,
      );

      y += 9;

      addRow(
        transferDirection,
        counterpartyName,
      );

      addRow(
        'Email',
        transaction.counterparty.email,
      );

      addRow(
        'Wallet',
        transaction.counterparty.walletId,
      );
    }

    if (transaction.sourceWalletId) {
      addRow(
        'Source Wallet',
        transaction.sourceWalletId,
      );
    }

    if (
      transaction.destinationWalletId
    ) {
      addRow(
        'Destination Wallet',
        transaction.destinationWalletId,
      );
    }

    addRow(
      'Completed At',
      transaction.completedAt
        ? new Date(
            transaction.completedAt,
          ).toLocaleString('en-IN')
        : '—',
    );

    y += 8;

    pdf.setDrawColor(220);
    pdf.line(
      20,
      y,
      190,
      y,
    );

    y += 10;

    pdf.setFontSize(9);
    pdf.setFont(
      'helvetica',
      'normal',
    );

    pdf.text(
      'Thank you for using Payflow.',
      20,
      y,
    );

    y += 6;

    pdf.text(
      `Receipt generated for transaction ${transaction.id}`,
      20,
      y,
    );

    pdf.save(
      `payflow-${transaction.type.toLowerCase()}-${transaction.id}.pdf`,
    );
  };
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Transaction History
            </h1>

            <p className="mt-2 text-slate-500">
              Review your deposits, withdrawals and transfers.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                void loadTransactions()
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
            >
              Refresh
            </button>

            <Link
              href="/dashboard"
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-3">
          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Current Balance
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {formatMoney(
                wallet?.balance ?? 0,
                wallet?.currency ?? 'INR',
              )}
            </p>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Total Records
            </p>

            <p className="mt-3 text-3xl font-bold text-sky-600">
              {transactions.length}
            </p>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Wallet Status
            </p>

            <p className="mt-3 text-3xl font-bold text-emerald-600">
              {wallet?.status ??
                'Unavailable'}
            </p>
          </article>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-7 overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-900">
              Transactions
            </h2>

            <div className="flex flex-1 flex-wrap gap-3">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search transactions..."
                className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-4 py-2 text-slate-800 outline-none focus:border-sky-500"
              />

              <input
                type="date"
                value={fromDate}
                onChange={(event) =>
                  setFromDate(event.target.value)
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-slate-800 outline-none focus:border-sky-500"
                title="From date"
              />

              <input
                type="date"
                value={toDate}
                onChange={(event) =>
                  setToDate(event.target.value)
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-slate-800 outline-none focus:border-sky-500"
                title="To date"
              />

              {(search ||
                fromDate ||
                toDate ||
                filter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setFromDate('');
                    setToDate('');
                    setFilter('ALL');
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <select
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value as
                    | 'ALL'
                    | 'DEPOSIT'
                    | 'WITHDRAWAL'
                    | 'TRANSFER',
                )
              }
              className="rounded-xl border border-slate-300 px-4 py-2 text-slate-800 outline-none"
            >
              <option value="ALL">
                All Types
              </option>

              <option value="DEPOSIT">
                Deposits
              </option>

              <option value="WITHDRAWAL">
                Withdrawals
              </option>

              <option value="TRANSFER">
                Transfers
              </option>
            </select>
          </div>

          {isLoading ? (
            <div className="p-12 text-center font-semibold text-slate-500">
              Loading transactions...
            </div>
          ) : filteredTransactions.length ===
            0 ? (
            <div className="p-12 text-center text-slate-500">
              No transactions found.
            </div>
          ) : (
            <>
<div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead className="bg-slate-50 text-left text-sm uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-4">
                      Date
                    </th>

                    <th className="px-6 py-4">
                      Type
                    </th>

                    <th className="px-6 py-4">
                      Details
                    </th>

                    <th className="px-6 py-4">
                      Status
                    </th>

                    <th className="px-6 py-4 text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedTransactions.map(
                    (transaction) => {
                      const sign =
                        wallet
                          ? getTransactionSign(
                              transaction,
                              wallet.id,
                            )
                          : '';

                      return (
                        <tr
                          key={transaction.id}
                          onClick={() =>
                            setSelectedTransaction(transaction)
                          }
                          className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-5 text-sm text-slate-600">
                            {new Date(
                              transaction.createdAt,
                            ).toLocaleString(
                              'en-IN',
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
                              {transaction.type}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-semibold text-slate-800">
                              {transaction.type === 'TRANSFER' &&
                              transaction.counterparty
                                ? `${
                                    wallet &&
                                    transaction.sourceWalletId === wallet.id
                                      ? 'Sent to'
                                      : 'Received from'
                                  } ${transaction.counterparty.firstName} ${
                                    transaction.counterparty.lastName ?? ''
                                  }`
                                : transaction.description ??
                                  transaction.reference ??
                                  'Payflow transaction'}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {transaction.type === 'TRANSFER' &&
                              transaction.counterparty && (
                                <span className="mb-1 block text-xs text-slate-500">
                                  {transaction.counterparty.email}
                                </span>
                              )}

                            {transaction.id}
                            </p>
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={
                                transaction.status ===
                                'COMPLETED'
                                  ? 'rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700'
                                  : transaction.status ===
                                      'FAILED'
                                    ? 'rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700'
                                    : 'rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700'
                              }
                            >
                              {transaction.status}
                            </span>
                          </td>

                          <td
                            className={
                              sign === '-'
                                ? 'px-6 py-5 text-right font-bold text-red-600'
                                : 'px-6 py-5 text-right font-bold text-emerald-600'
                            }
                          >
                            {sign}
                            {formatMoney(
                              transaction.amount,
                              transaction.currency,
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
        {filteredTransactions.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-5">
            <p className="text-sm text-slate-500">
              Showing{' '}
              {(currentPage - 1) *
                pageSize +
                1}
              {' - '}
              {Math.min(
                currentPage *
                  pageSize,
                filteredTransactions.length,
              )}{' '}
              of{' '}
              {filteredTransactions.length}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        1,
                        page - 1,
                      ),
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="text-sm font-semibold text-slate-700">
                Page {currentPage} of{' '}
                {totalPages}
              </span>

              <button
                type="button"
                disabled={
                  currentPage ===
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.min(
                        totalPages,
                        page + 1,
                      ),
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
          </>
          )}
        </section>
      </section>
    
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-600">
                  Transaction Details
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  {selectedTransaction.type}
                </h2>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadReceipt(
                      selectedTransaction,
                    )
                  }
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  Download Receipt
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedTransaction(null)
                  }
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Transaction ID
                </p>
                <p className="mt-1 break-all text-sm text-slate-800">
                  {selectedTransaction.id}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Status
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {selectedTransaction.status}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Amount
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {formatMoney(
                    selectedTransaction.amount,
                    selectedTransaction.currency,
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Created At
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  {new Date(
                    selectedTransaction.createdAt,
                  ).toLocaleString('en-IN')}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Reference
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  {selectedTransaction.reference ?? '—'}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Description
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  {selectedTransaction.description ?? '—'}
                </p>
              </div>

              {selectedTransaction.type === 'TRANSFER' && (
                <>
                  {selectedTransaction.counterparty && (
                    <div className="md:col-span-2 rounded-xl border border-sky-100 bg-sky-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-sky-600">
                        {wallet &&
                        selectedTransaction.sourceWalletId === wallet.id
                          ? 'Sent To'
                          : 'Received From'}
                      </p>

                      <p className="mt-2 text-lg font-bold text-slate-900">
                        {selectedTransaction.counterparty.firstName}{' '}
                        {selectedTransaction.counterparty.lastName ?? ''}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {selectedTransaction.counterparty.email}
                      </p>

                      <p className="mt-2 break-all text-xs text-slate-400">
                        Wallet: {selectedTransaction.counterparty.walletId}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Source Wallet
                    </p>
                    <p className="mt-1 break-all text-sm text-slate-800">
                      {selectedTransaction.sourceWalletId ?? '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Destination Wallet
                    </p>
                    <p className="mt-1 break-all text-sm text-slate-800">
                      {selectedTransaction.destinationWalletId ?? '—'}
                    </p>
                  </div>
                </>
              )}

              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Completed At
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  {selectedTransaction.completedAt
                    ? new Date(
                        selectedTransaction.completedAt,
                      ).toLocaleString('en-IN')
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
</main>
  );
}















