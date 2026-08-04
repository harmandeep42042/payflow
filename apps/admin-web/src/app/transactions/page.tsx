'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import {
  adminAuthenticatedRequest,
  clearAdminSession,
  getStoredAdmin,
  hasValidAdminSession,
} from '../lib/api';

type TransactionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
};

type AdminTransaction = {
  id: string;
  type:
    | 'DEPOSIT'
    | 'WITHDRAWAL'
    | 'TRANSFER';
  amount: string;
  currency: string;
  status:
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'REVERSED';
  reference?: string | null;
  description?: string | null;
  failureReason?: string | null;
  walletId?: string | null;
  sourceWalletId?: string | null;
  destinationWalletId?: string | null;
  user: TransactionUser;
  destinationUser?: TransactionUser | null;
  createdAt: string;
  completedAt?: string | null;
};

type TransactionsResponse = {
  transactions: AdminTransaction[];

  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  filters: {
    search: string;
    type: string;
    status: string;
  };
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

function getStatusClasses(
  status: AdminTransaction['status'],
): string {
  if (status === 'COMPLETED') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'FAILED') {
    return 'bg-red-100 text-red-700';
  }

  if (status === 'REVERSED') {
    return 'bg-violet-100 text-violet-700';
  }

  if (status === 'PROCESSING') {
    return 'bg-sky-100 text-sky-700';
  }

  return 'bg-amber-100 text-amber-700';
}

function getTypeClasses(
  type: AdminTransaction['type'],
): string {
  if (type === 'DEPOSIT') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (type === 'WITHDRAWAL') {
    return 'bg-red-100 text-red-700';
  }

  return 'bg-violet-100 text-violet-700';
}

export default function TransactionsPage() {
  const router = useRouter();

  const [
    transactions,
    setTransactions,
  ] = useState<AdminTransaction[]>([]);

  const [searchInput, setSearchInput] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [type, setType] =
    useState('ALL');

  const [status, setStatus] =
    useState('ALL');

  const [page, setPage] =
    useState(1);

  const [limit] =
    useState(10);

  const [total, setTotal] =
    useState(0);

  const [totalPages, setTotalPages] =
    useState(0);

  const [hasNextPage, setHasNextPage] =
    useState(false);

  const [
    hasPreviousPage,
    setHasPreviousPage,
  ] = useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const loadTransactions = useCallback(
    async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError('');

        const query =
          new URLSearchParams({
            page: String(page),
            limit: String(limit),
            search,
            type,
            status,
          });

        const response =
          await adminAuthenticatedRequest<TransactionsResponse>(
            `/admin/transactions?${query.toString()}`,
          );

        setTransactions(
          response.transactions,
        );

        setTotal(
          response.pagination.total,
        );

        setTotalPages(
          response.pagination.totalPages,
        );

        setHasNextPage(
          response.pagination.hasNextPage,
        );

        setHasPreviousPage(
          response.pagination
            .hasPreviousPage,
        );
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load transactions';

        if (
          message
            .toLowerCase()
            .includes('session') ||
          message
            .toLowerCase()
            .includes('unauthorized')
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
      limit,
      page,
      router,
      search,
      status,
      type,
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

    void loadTransactions();
  }, [
    loadTransactions,
    router,
  ]);

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    setPage(1);
    setSearch(
      searchInput.trim(),
    );
  }

  function clearFilters(): void {
    setSearchInput('');
    setSearch('');
    setType('ALL');
    setStatus('ALL');
    setPage(1);
  }

  function escapeCsvValue(
    value: unknown,
  ): string {
    const text =
      value === null ||
      value === undefined
        ? ''
        : String(value);

    return `"${text.replace(
      /"/g,
      '""',
    )}"`;
  }

  function exportTransactionsCsv(): void {
    if (transactions.length === 0) {
      setError(
        'There are no transactions to export.',
      );
      return;
    }

    const headers = [
      'Transaction ID',
      'Type',
      'Amount',
      'Currency',
      'Status',
      'User Name',
      'User Email',
      'Destination User',
      'Wallet ID',
      'Source Wallet ID',
      'Destination Wallet ID',
      'Reference',
      'Description',
      'Failure Reason',
      'Created At',
      'Completed At',
    ];

    const rows = transactions.map(
      (transaction) => [
        transaction.id,
        transaction.type,
        transaction.amount,
        transaction.currency,
        transaction.status,
        `${transaction.user.firstName} ${
          transaction.user.lastName ?? ''
        }`.trim(),
        transaction.user.email,
        transaction.destinationUser
          ? `${
              transaction.destinationUser
                .firstName
            } ${
              transaction.destinationUser
                .lastName ?? ''
            }`.trim()
          : '',
        transaction.walletId ?? '',
        transaction.sourceWalletId ?? '',
        transaction.destinationWalletId ??
          '',
        transaction.reference ?? '',
        transaction.description ?? '',
        transaction.failureReason ?? '',
        transaction.createdAt,
        transaction.completedAt ?? '',
      ],
    );

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) =>
        row.map(escapeCsvValue).join(','),
      ),
    ].join('\r\n');

    const csvBlob = new Blob(
      [csvContent],
      {
        type:
          'text/csv;charset=utf-8;',
      },
    );

    const downloadUrl =
      URL.createObjectURL(csvBlob);

    const link =
      document.createElement('a');

    link.href = downloadUrl;
    link.download =
      `payflow-transactions-page-${page}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(
      downloadUrl,
    );
  }

  function exportTransactionsPdf(): void {
    if (transactions.length === 0) {
      setError(
        'There are no transactions to export.',
      );
      return;
    }

    setError('');

    const document = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const generatedAt =
      new Date().toLocaleString('en-IN');

    const totalAmount =
      transactions.reduce(
        (sum, transaction) =>
          sum + Number(transaction.amount),
        0,
      );

    document.setFontSize(20);
    document.text(
      'Payflow Transactions Report',
      14,
      18,
    );

    document.setFontSize(10);
    document.text(
      `Generated: ${generatedAt}`,
      14,
      26,
    );

    document.text(
      `Page: ${page}`,
      14,
      32,
    );

    document.text(
      `Transactions: ${transactions.length}`,
      75,
      32,
    );

    document.text(
      `Total Amount: INR ${formatMoney(
        totalAmount,
      )}`,
      135,
      32,
    );

    document.text(
      `Type Filter: ${type}`,
      210,
      32,
    );

    document.text(
      `Status Filter: ${status}`,
      14,
      38,
    );

    if (search) {
      document.text(
        `Search: ${search}`,
        75,
        38,
      );
    }

    autoTable(document, {
      startY: 45,

      head: [
        [
          'Type',
          'Transaction ID',
          'User',
          'Email',
          'Amount',
          'Status',
          'Reference / Description',
          'Created At',
        ],
      ],

      body: transactions.map(
        (transaction) => [
          transaction.type,

          transaction.id,

          `${transaction.user.firstName} ${
            transaction.user.lastName ?? ''
          }`.trim(),

          transaction.user.email,

          `${transaction.currency} ${formatMoney(
            transaction.amount,
          )}`,

          transaction.status,

          transaction.reference ??
            transaction.description ??
            transaction.failureReason ??
            '-',

          new Date(
            transaction.createdAt,
          ).toLocaleString('en-IN'),
        ],
      ),

      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        overflow: 'linebreak',
      },

      headStyles: {
        fontStyle: 'bold',
      },

      columnStyles: {
        0: {
          cellWidth: 24,
        },

        1: {
          cellWidth: 44,
        },

        2: {
          cellWidth: 30,
        },

        3: {
          cellWidth: 42,
        },

        4: {
          cellWidth: 28,
        },

        5: {
          cellWidth: 25,
        },

        6: {
          cellWidth: 48,
        },

        7: {
          cellWidth: 36,
        },
      },

      didDrawPage: () => {
        const pageCount =
          document.getNumberOfPages();

        document.setFontSize(8);

        document.text(
          `Generated by Payflow Admin | Page ${pageCount}`,
          14,
          document.internal.pageSize.height -
            8,
        );
      },
    });

    document.save(
      `payflow-transactions-page-${page}.pdf`,
    );
  }

  function handleLogout(): void {
    clearAdminSession();
    router.push('/login');
    router.refresh();
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
              Transactions Management
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
                router.push('/users')
              }
              className="rounded-xl border border-sky-500 bg-white px-4 py-2 font-semibold text-sky-600 transition hover:bg-sky-50"
            >
              Users
            </button>

            <button
              type="button"
              onClick={() =>
                router.push('/wallets')
              }
              className="rounded-xl border border-emerald-500 bg-white px-4 py-2 font-semibold text-emerald-600 transition hover:bg-emerald-50"
            >
              Wallets
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
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
            Administration
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Payflow transactions
          </h2>

          <p className="mt-2 text-slate-600">
            Review deposits, withdrawals and
            wallet transfers.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form
            onSubmit={handleSearch}
            className="grid gap-4 lg:grid-cols-[1fr_190px_190px_auto_auto]"
          >
            <input
              type="text"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  event.target.value,
                )
              }
              placeholder="Search transaction, wallet or reference"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />

            <select
              value={type}
              onChange={(event) => {
                setType(
                  event.target.value,
                );
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="ALL">
                All types
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

            <select
              value={status}
              onChange={(event) => {
                setStatus(
                  event.target.value,
                );
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="PENDING">
                Pending
              </option>

              <option value="PROCESSING">
                Processing
              </option>

              <option value="COMPLETED">
                Completed
              </option>

              <option value="FAILED">
                Failed
              </option>

              <option value="REVERSED">
                Reversed
              </option>
            </select>

            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-600"
            >
              Search
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Clear
            </button>
          </form>
        </section>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Transactions list
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Total transactions: {total}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={exportTransactionsCsv}
                disabled={
                  isLoading ||
                  transactions.length === 0
                }
                className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export CSV
              </button>

              <button
                type="button"
                onClick={exportTransactionsPdf}
                disabled={
                  isLoading ||
                  transactions.length === 0
                }
                className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export PDF
              </button>

              <button
                type="button"
                onClick={() =>
                  void loadTransactions()
                }
                className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center font-semibold text-slate-500">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">
                      Transaction
                    </th>

                    <th className="px-6 py-4">
                      User
                    </th>

                    <th className="px-6 py-4">
                      Wallet details
                    </th>

                    <th className="px-6 py-4">
                      Amount
                    </th>

                    <th className="px-6 py-4">
                      Status
                    </th>

                    <th className="px-6 py-4">
                      Details
                    </th>

                    <th className="px-6 py-4">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {transactions.map(
                    (transaction) => {
                      const details =
                        transaction.reference ??
                        transaction.description ??
                        transaction.failureReason ??
                        '-';

                      return (
                        <tr
                          key={transaction.id}
                          onClick={() =>
                            router.push(
                              `/transactions/${transaction.id}`,
                            )
                          }
                          className="cursor-pointer transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${getTypeClasses(
                                transaction.type,
                              )}`}
                            >
                              {transaction.type}
                            </span>

                            <p className="mt-3 max-w-xs break-all text-xs text-slate-400">
                              {transaction.id}
                            </p>
                          </td>

                          <td className="px-6 py-5">
                            <p className="font-semibold text-slate-900">
                              {
                                transaction.user
                                  .firstName
                              }{' '}
                              {transaction.user
                                .lastName ?? ''}
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {
                                transaction.user
                                  .email
                              }
                            </p>

                            {transaction.destinationUser ? (
                              <p className="mt-2 text-xs text-slate-400">
                                To:{' '}
                                {
                                  transaction
                                    .destinationUser
                                    .email
                                }
                              </p>
                            ) : null}
                          </td>

                          <td className="px-6 py-5">
                            {transaction.walletId ? (
                              <p className="max-w-xs break-all text-xs text-slate-500">
                                Wallet:{' '}
                                {
                                  transaction.walletId
                                }
                              </p>
                            ) : null}

                            {transaction.sourceWalletId ? (
                              <p className="max-w-xs break-all text-xs text-slate-500">
                                From:{' '}
                                {
                                  transaction
                                    .sourceWalletId
                                }
                              </p>
                            ) : null}

                            {transaction.destinationWalletId ? (
                              <p className="mt-1 max-w-xs break-all text-xs text-slate-500">
                                To:{' '}
                                {
                                  transaction
                                    .destinationWalletId
                                }
                              </p>
                            ) : null}
                          </td>

                          <td className="px-6 py-5">
                            <p
                              className={`font-bold ${
                                transaction.type ===
                                'DEPOSIT'
                                  ? 'text-emerald-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {transaction.type ===
                              'DEPOSIT'
                                ? '+'
                                : '-'}
                              {
                                transaction.currency
                              }{' '}
                              {formatMoney(
                                transaction.amount,
                              )}
                            </p>
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(
                                transaction.status,
                              )}`}
                            >
                              {transaction.status}
                            </span>
                          </td>

                          <td className="max-w-xs px-6 py-5 text-sm text-slate-600">
                            {details}
                          </td>

                          <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-500">
                            {new Date(
                              transaction.createdAt,
                            ).toLocaleString(
                              'en-IN',
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 px-6 py-5 sm:flex-row">
            <p className="text-sm text-slate-500">
              Page {page} of{' '}
              {totalPages || 1}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={
                  !hasPreviousPage ||
                  isLoading
                }
                onClick={() =>
                  setPage((current) =>
                    Math.max(
                      current - 1,
                      1,
                    ),
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={
                  !hasNextPage ||
                  isLoading
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      current + 1,
                  )
                }
                className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}