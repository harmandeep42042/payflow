'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import Link from 'next/link';

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
  currency: string;
  balance: string;
  status: string;
};

type TransferResponse = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  sourceWallet: {
    id: string;
    balance: string;
    currency: string;
  };
  destinationWallet: {
    id: string;
    balance: string;
    currency: string;
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

export default function TransferPage() {
  const router = useRouter();

  const [wallet, setWallet] =
    useState<UserWallet | null>(null);

  const [
    destinationWalletId,
    setDestinationWalletId,
  ] = useState(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  );

  const [amount, setAmount] =
    useState('10.00');

  const [
    description,
    setDescription,
  ] = useState(
    'Payment from User Portal',
  );

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const loadWallet =
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

          const response =
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

          if (Array.isArray(response)) {
            resolvedWallet =
              response[0] ?? null;
          } else if (
            response &&
            typeof response === 'object' &&
            'id' in response
          ) {
            resolvedWallet =
              response as UserWallet;
          } else if (
            response &&
            typeof response === 'object' &&
            'data' in response
          ) {
            resolvedWallet =
              response.data ?? null;
          } else if (
            response &&
            typeof response === 'object' &&
            'wallets' in response
          ) {
            resolvedWallet =
              response.wallets?.[0] ??
              null;
          }

          if (!resolvedWallet?.id) {
            throw new Error(
              'Wallet details were not found',
            );
          }

          setWallet(resolvedWallet);
        } catch (requestError) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load wallet',
          );
        } finally {
          setIsLoading(false);
        }
      },
      [router],
    );

  useEffect(() => {
    void loadWallet();

    const handleFocus = (): void => {
      void loadWallet();
    };

    const handleVisibilityChange = (): void => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        void loadWallet();
      }
    };

    window.addEventListener(
      'focus',
      handleFocus,
    );

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      window.removeEventListener(
        'focus',
        handleFocus,
      );

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, [loadWallet]);

  async function handleTransfer(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!wallet) {
      setError(
        'Source wallet is unavailable',
      );
      return;
    }

    if (
      destinationWalletId.trim() ===
      wallet.id
    ) {
      setError(
        'You cannot transfer money to the same wallet',
      );
      return;
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError(
        'Please enter a valid amount',
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');

      const response =
        await userAuthenticatedRequest<TransferResponse>(
          '/wallets/transfer',
          {
            method: 'POST',

            body: JSON.stringify({
              sourceWalletId:
                wallet.id,

              destinationWalletId:
                destinationWalletId.trim(),

              amount:
                numericAmount.toFixed(2),

              currency:
                wallet.currency,

              description:
                description.trim() ||
                undefined,

              idempotencyKey:
                `web-transfer-${crypto.randomUUID()}`,
            }),
          },
        );

      setSuccess(
        `Transfer successful. ${formatMoney(
          response.amount,
          response.currency,
        )} sent successfully.`,
      );

      setWallet({
        ...wallet,
        balance:
          response.sourceWallet.balance,
      });

      setAmount('');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Transfer failed',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Send Money
            </h1>

            <p className="mt-2 text-slate-500">
              Transfer funds to another Payflow wallet.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
          >
            Back to Dashboard
          </Link>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-3xl bg-gradient-to-br from-sky-500 to-blue-700 p-7 text-white shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-100">
              Available Balance
            </p>

            <p className="mt-4 text-4xl font-bold">
              {isLoading
                ? 'Loading...'
                : formatMoney(
                    wallet?.balance ?? 0,
                    wallet?.currency ??
                      'INR',
                  )}
            </p>

            <p className="mt-6 break-all text-sm text-sky-100">
              Wallet ID:
              <br />
              {wallet?.id ??
                'Unavailable'}
            </p>

            <p className="mt-4 text-sm">
              Status:{' '}
              <strong>
                {wallet?.status ??
                  'Unavailable'}
              </strong>
            </p>
          </aside>

          <form
            onSubmit={handleTransfer}
            className="rounded-3xl bg-white p-7 shadow-sm"
          >
            <div>
              <label
                htmlFor="destinationWalletId"
                className="text-sm font-semibold text-slate-700"
              >
                Receiver Wallet ID
              </label>

              <input
                id="destinationWalletId"
                value={
                  destinationWalletId
                }
                onChange={(event) =>
                  setDestinationWalletId(
                    event.target.value,
                  )
                }
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="amount"
                className="text-sm font-semibold text-slate-700"
              >
                Amount
              </label>

              <input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(event) =>
                  setAmount(
                    event.target.value,
                  )
                }
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="description"
                className="text-sm font-semibold text-slate-700"
              >
                Description
              </label>

              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                isLoading ||
                !wallet
              }
              className="mt-6 w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Sending...'
                : 'Send Money'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
