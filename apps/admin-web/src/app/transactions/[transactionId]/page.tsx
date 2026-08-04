'use client';

import {
  useEffect,
  useState,
} from 'react';
import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  adminAuthenticatedRequest,
  clearAdminSession,
  hasValidAdminSession,
} from '../../lib/api';

type TransactionUser = {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  role: string;
  status: string;
};

type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  currency?: string;
  status: string;
};

type WalletDetails = {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  status: string;
  user: TransactionUser;
  ledgerAccount?: LedgerAccount | null;
};

type LedgerEntry = {
  id: string;
  ledgerAccountId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: string;
  currency: string;
  createdAt: string;
  ledgerAccount: LedgerAccount;
};

type BaseTransaction = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  ledgerEntries: LedgerEntry[];
};

type DepositTransaction =
  BaseTransaction & {
    walletId: string;
    reference: string;
    wallet: WalletDetails;
  };

type WithdrawalTransaction =
  BaseTransaction & {
    walletId: string;
    reference: string;
    wallet: WalletDetails;
  };

type TransferTransaction =
  BaseTransaction & {
    sourceWalletId: string;
    destinationWalletId: string;
    description?: string | null;
    sourceWallet: WalletDetails;
    destinationWallet: WalletDetails;
  };

type TransactionDetailsResponse =
  | {
      type: 'DEPOSIT';
      transaction: DepositTransaction;
    }
  | {
      type: 'WITHDRAWAL';
      transaction: WithdrawalTransaction;
    }
  | {
      type: 'TRANSFER';
      transaction: TransferTransaction;
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

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return 'Not completed';
  }

  return new Date(value).toLocaleString(
    'en-IN',
  );
}

export default function TransactionDetailsPage() {
  const router = useRouter();
  const params = useParams<{
    transactionId: string;
  }>();

  const [
    details,
    setDetails,
  ] =
    useState<TransactionDetailsResponse | null>(
      null,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    if (!hasValidAdminSession()) {
      router.replace('/login');
      return;
    }

    async function loadDetails(): Promise<void> {
      try {
        setIsLoading(true);
        setError('');

        const response =
          await adminAuthenticatedRequest<TransactionDetailsResponse>(
            `/admin/transactions/${params.transactionId}`,
          );

        setDetails(response);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load transaction details';

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
    }

    void loadDetails();
  }, [
    params.transactionId,
    router,
  ]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="font-semibold text-slate-600">
          Loading transaction details...
        </p>
      </main>
    );
  }

  if (error || !details) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-700">
            {error ||
              'Transaction details not found'}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push('/transactions')
            }
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
          >
            Back to transactions
          </button>
        </div>
      </main>
    );
  }

  const transaction =
    details.transaction;

  const isTransfer =
    details.type === 'TRANSFER';

  const singleWallet =
    details.type === 'DEPOSIT' ||
    details.type === 'WITHDRAWAL'
      ? details.transaction.wallet
      : null;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-sky-600">
              Payflow Admin
            </h1>

            <p className="text-sm text-slate-500">
              Transaction Details
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push('/transactions')
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Back to transactions
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
                {details.type}
              </p>

              <h2 className="mt-2 break-all text-3xl font-bold text-slate-900">
                {transaction.id}
              </h2>

              <p className="mt-2 text-slate-500">
                Complete transaction record
              </p>
            </div>

            <div className="text-left md:text-right">
              <p className="text-3xl font-bold text-slate-900">
                {transaction.currency}{' '}
                {formatMoney(
                  transaction.amount,
                )}
              </p>

              <span className="mt-3 inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                {transaction.status}
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Created
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(
                  transaction.createdAt,
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Completed
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(
                  transaction.completedAt,
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Updated
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {formatDate(
                  transaction.updatedAt,
                )}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Failure reason
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                {transaction.failureReason ??
                  'None'}
              </p>
            </div>
          </div>
        </section>

        {singleWallet ? (
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">
                User details
              </h3>

              <div className="mt-5 space-y-3 text-sm">
                <p>
                  <span className="font-semibold text-slate-700">
                    Name:
                  </span>{' '}
                  {
                    singleWallet.user.firstName
                  }{' '}
                  {singleWallet.user.lastName ??
                    ''}
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Email:
                  </span>{' '}
                  {singleWallet.user.email}
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Phone:
                  </span>{' '}
                  {singleWallet.user.phone ??
                    'Not available'}
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Role:
                  </span>{' '}
                  {singleWallet.user.role}
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">
                Wallet details
              </h3>

              <div className="mt-5 space-y-3 text-sm">
                <p className="break-all">
                  <span className="font-semibold text-slate-700">
                    Wallet ID:
                  </span>{' '}
                  {singleWallet.id}
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Balance:
                  </span>{' '}
                  {singleWallet.currency}{' '}
                  {formatMoney(
                    singleWallet.balance,
                  )}
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Status:
                  </span>{' '}
                  {singleWallet.status}
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Ledger:
                  </span>{' '}
                  {singleWallet.ledgerAccount
                    ?.code ?? 'Not available'}
                </p>
              </div>
            </article>
          </section>
        ) : null}

        {isTransfer ? (
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">
                Sender
              </h3>

              <div className="mt-5 space-y-3 text-sm">
                <p>
                  <span className="font-semibold text-slate-700">
                    Name:
                  </span>{' '}
                  {
                    details.transaction
                      .sourceWallet.user
                      .firstName
                  }{' '}
                  {details.transaction
                    .sourceWallet.user
                    .lastName ?? ''}
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Email:
                  </span>{' '}
                  {
                    details.transaction
                      .sourceWallet.user.email
                  }
                </p>

                <p className="break-all">
                  <span className="font-semibold text-slate-700">
                    Wallet:
                  </span>{' '}
                  {
                    details.transaction
                      .sourceWallet.id
                  }
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Balance:
                  </span>{' '}
                  {
                    details.transaction
                      .sourceWallet.currency
                  }{' '}
                  {formatMoney(
                    details.transaction
                      .sourceWallet.balance,
                  )}
                </p>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900">
                Receiver
              </h3>

              <div className="mt-5 space-y-3 text-sm">
                <p>
                  <span className="font-semibold text-slate-700">
                    Name:
                  </span>{' '}
                  {
                    details.transaction
                      .destinationWallet.user
                      .firstName
                  }{' '}
                  {details.transaction
                    .destinationWallet.user
                    .lastName ?? ''}
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Email:
                  </span>{' '}
                  {
                    details.transaction
                      .destinationWallet.user
                      .email
                  }
                </p>

                <p className="break-all">
                  <span className="font-semibold text-slate-700">
                    Wallet:
                  </span>{' '}
                  {
                    details.transaction
                      .destinationWallet.id
                  }
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Balance:
                  </span>{' '}
                  {
                    details.transaction
                      .destinationWallet.currency
                  }{' '}
                  {formatMoney(
                    details.transaction
                      .destinationWallet.balance,
                  )}
                </p>
              </div>
            </article>
          </section>
        ) : null}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">
            Ledger entries
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Double-entry accounting records for this transaction.
          </p>

          {transaction.ledgerEntries.length ===
          0 ? (
            <p className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-slate-500">
              No ledger entries found.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">
                      Entry
                    </th>

                    <th className="px-4 py-3">
                      Account
                    </th>

                    <th className="px-4 py-3">
                      Amount
                    </th>

                    <th className="px-4 py-3">
                      Date
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {transaction.ledgerEntries.map(
                    (entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              entry.entryType ===
                              'CREDIT'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {entry.entryType}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">
                            {
                              entry.ledgerAccount
                                .code
                            }
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {
                              entry.ledgerAccount
                                .name
                            }
                          </p>
                        </td>

                        <td className="px-4 py-4 font-bold text-slate-900">
                          {entry.currency}{' '}
                          {formatMoney(
                            entry.amount,
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">
                          {formatDate(
                            entry.createdAt,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}