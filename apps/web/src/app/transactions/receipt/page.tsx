'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  Card,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
  StatusBadge,
} from '../../components/customer';

import {
  getStoredUser,
  userAuthenticatedRequest,
} from '../../lib/api';

import {
  buildReceiptShareText,
  buildRepeatPaymentHref,
  findReceiptTransaction,
  getReceiptCounterpartyLabel,
  getReceiptDirection,
  getReceiptTransactionId,
  normalizeReceiptHistory,
  type ReceiptTransaction,
} from './transaction-receipt';

import { buildPaymentHelpHref } from '../../help/payment-help-deeplink';

type Wallet = {
  id: string;
  currency: string;
  status: string;
};

type WalletResponse =
  | Wallet[]
  | {
      wallets?: Wallet[];
    };

export default function TransactionReceiptPage() {
  const [user] =
    useState(getStoredUser);

  const [
    transaction,
    setTransaction,
  ] =
    useState<ReceiptTransaction | null>(
      null,
    );

  const [
    ownedWalletIds,
    setOwnedWalletIds,
  ] = useState<string[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    notFound,
    setNotFound,
  ] = useState(false);

  const [
    shareStatus,
    setShareStatus,
  ] = useState('');

  useEffect(() => {
    let active = true;

    async function loadReceipt() {
      setLoading(true);
      setError('');
      setNotFound(false);

      const transactionId =
        getReceiptTransactionId(
          new URLSearchParams(
            window.location.search,
          ),
        );

      if (!transactionId) {
        if (active) {
          setError(
            'A valid transaction ID is required to open this receipt.',
          );
          setLoading(false);
        }

        return;
      }

      if (!user?.id) {
        if (active) {
          setError(
            'Sign in to view your transaction receipt.',
          );
          setLoading(false);
        }

        return;
      }

      try {
        const walletResponse =
          await userAuthenticatedRequest<WalletResponse>(
            `/wallets/user/${encodeURIComponent(
              user.id,
            )}`,
          );

        const wallets =
          Array.isArray(
            walletResponse,
          )
            ? walletResponse
            : walletResponse.wallets ??
              [];

        const walletIds =
          wallets.map(
            (wallet) =>
              wallet.id,
          );

        if (active) {
          setOwnedWalletIds(
            walletIds,
          );
        }

        if (
          wallets.length === 0
        ) {
          if (active) {
            setNotFound(true);
            setLoading(false);
          }

          return;
        }

        const responses =
          await Promise.all(
            wallets.map(
              (wallet) =>
                userAuthenticatedRequest<unknown>(
                  `/wallets/${encodeURIComponent(
                    wallet.id,
                  )}/transactions?page=1&limit=100&type=ALL`,
                ),
            ),
          );

        const transactions =
          responses.flatMap(
            (response) =>
              normalizeReceiptHistory(
                response,
              ),
          );

        const match =
          findReceiptTransaction(
            transactions,
            transactionId,
          );

        if (!active) {
          return;
        }

        if (!match) {
          setNotFound(true);
          setTransaction(null);
          return;
        }

        setTransaction(match);
      } catch (reason) {
        if (!active) {
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load this transaction receipt.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReceipt();

    return () => {
      active = false;
    };
  }, [user]);

  const direction =
    transaction
      ? getReceiptDirection(
          transaction,
          ownedWalletIds,
        )
      : null;

  const counterparty =
    transaction
      ? getReceiptCounterpartyLabel(
          transaction.counterparty,
        )
      : null;

  const repeatPaymentHref =
    transaction
      ? buildRepeatPaymentHref(
          transaction.counterparty,
        )
      : null;

  const paymentHelpHref =
    transaction
      ? buildPaymentHelpHref(
          transaction.id,
        )
      : null;

  async function shareReceipt() {
    if (!transaction) {
      return;
    }

    setShareStatus('');

    const text =
      buildReceiptShareText(
        transaction,
      );

    const url =
      window.location.href;

    type ShareNavigator =
      Navigator & {
        share?: (
          data: ShareData,
        ) => Promise<void>;
      };

    const shareNavigator =
      navigator as ShareNavigator;

    try {
      if (
        typeof shareNavigator.share ===
        'function'
      ) {
        await shareNavigator.share({
          title:
            'Payflow transaction receipt',
          text,
          url,
        });

        setShareStatus(
          'Receipt shared.',
        );

        return;
      }

      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          'function'
      ) {
        await navigator.clipboard.writeText(
          `${text}\n${url}`,
        );

        setShareStatus(
          'Receipt details copied to clipboard.',
        );

        return;
      }

      setShareStatus(
        'Sharing is not available on this device.',
      );
    } catch (reason) {
      if (
        reason instanceof Error &&
        reason.name === 'AbortError'
      ) {
        return;
      }

      setShareStatus(
        'Unable to share this receipt.',
      );
    }
  }

  return (
    <main>
      <PageContainer className="max-w-3xl">
        <PageHeader
          eyebrow="Receipt"
          title="Transaction receipt"
          description="Read-only details from your authenticated Payflow wallet history. Opening this receipt does not move money."
          actions={
            <a
              href="/transactions"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Back to transactions
            </a>
          }
        />

        {loading ? (
          <div className="mt-6">
            <LoadingState />
          </div>
        ) : null}

        {!loading &&
        error ? (
          <div className="mt-6">
            <ErrorState
              message={error}
            />
          </div>
        ) : null}

        {!loading &&
        !error &&
        notFound ? (
          <div className="mt-6">
            <ErrorState
              message="Transaction not found in your available authenticated wallet history."
            />
          </div>
        ) : null}

        {!loading &&
        !error &&
        transaction ? (
          <Card className="mt-6 overflow-hidden p-0">
            <section
              aria-labelledby="receipt-title"
              className="p-5 sm:p-7"
            >
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {direction}
                  </p>

                  <h2
                    id="receipt-title"
                    className="mt-1 text-3xl font-black tracking-tight text-slate-950"
                  >
                    {
                      transaction.currency
                    }{' '}
                    {
                      transaction.amount
                    }
                  </h2>

                  <p className="mt-2 text-sm text-slate-600">
                    {new Date(
                      transaction.createdAt,
                    ).toLocaleString()}
                  </p>
                </div>

                <StatusBadge
                  status={
                    transaction.status
                  }
                />
              </div>

              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Transaction ID
                  </dt>

                  <dd className="mt-1 break-all font-mono text-sm font-semibold text-slate-950">
                    {
                      transaction.id
                    }
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Type
                  </dt>

                  <dd className="mt-1 text-sm font-semibold text-slate-950">
                    {
                      transaction.type
                    }
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </dt>

                  <dd className="mt-1 text-sm font-semibold text-slate-950">
                    {
                      transaction.status
                    }
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Direction
                  </dt>

                  <dd className="mt-1 text-sm font-semibold text-slate-950">
                    {direction}
                  </dd>
                </div>

                {transaction.description ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Description
                    </dt>

                    <dd className="mt-1 text-sm text-slate-800">
                      {
                        transaction.description
                      }
                    </dd>
                  </div>
                ) : null}

                {counterparty ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Counterparty
                    </dt>

                    <dd className="mt-1 text-sm font-semibold text-slate-950">
                      {counterparty}
                    </dd>
                  </div>
                ) : null}

                {transaction
                  .counterparty
                  ?.email ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Counterparty email
                    </dt>

                    <dd className="mt-1 break-all text-sm text-slate-800">
                      {
                        transaction
                          .counterparty
                          .email
                      }
                    </dd>
                  </div>
                ) : null}

                {transaction
                  .sourceWalletId ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Source wallet
                    </dt>

                    <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                      {
                        transaction
                          .sourceWalletId
                      }
                    </dd>
                  </div>
                ) : null}

                {transaction
                  .destinationWalletId ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Destination wallet
                    </dt>

                    <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                      {
                        transaction
                          .destinationWalletId
                      }
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-5 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    void shareReceipt()
                  }
                  className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 sm:w-auto"
                >
                  Share receipt
                </button>

                {repeatPaymentHref ? (
                  <a
                    href={
                      repeatPaymentHref
                    }
                    className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto"
                  >
                    Repeat payment
                  </a>
                ) : null}

                {paymentHelpHref ? (
                  <a
                    href={
                      paymentHelpHref
                    }
                    className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto"
                  >
                    Get help with this payment
                  </a>
                ) : null}
              </div>

              {paymentHelpHref ? (
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Help only carries this transaction ID into the support form. You must choose the issue, add your description, and explicitly press Create case.
                </p>
              ) : null}

              {repeatPaymentHref ? (
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Repeat payment only opens Send Money with the returned payment address. Review the recipient, enter the amount, and explicitly confirm before money can move.
                </p>
              ) : null}

              {shareStatus ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-3 text-sm font-medium text-slate-700"
                >
                  {shareStatus}
                </p>
              ) : null}

              <p className="mt-4 text-xs leading-5 text-slate-600">
                This receipt reflects Payflow&apos;s authenticated wallet record. It does not claim bank, PSP, NPCI, or live UPI confirmation.
              </p>
            </div>
          </Card>
        ) : null}
      </PageContainer>
    </main>
  );
}
