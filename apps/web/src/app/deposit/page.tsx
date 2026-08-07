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

type DepositResponse = {
  id: string;
  walletId: string;
  amount: string;
  currency: string;
  reference?: string | null;
  status: string;
  wallet: {
    id: string;
    balance: string;
    currency: string;
    version: number;
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

export default function DepositPage() {
  const router = useRouter();

  const [wallet, setWallet] =
    useState<UserWallet | null>(null);

  const [amount, setAmount] =
    useState('100.00');

  const [reference, setReference] =
    useState('USER-PORTAL-DEPOSIT');

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
  }, [loadWallet]);

  async function handleDeposit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!wallet) {
      setError(
        'Wallet is unavailable',
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
        await userAuthenticatedRequest<DepositResponse>(
          '/wallets/deposit',
          {
            method: 'POST',

            body: JSON.stringify({
              walletId:
                wallet.id,

              amount:
                numericAmount.toFixed(2),

              currency:
                wallet.currency,

              reference:
                reference.trim() ||
                undefined,

              idempotencyKey:
                `web-deposit-${crypto.randomUUID()}`,
            }),
          },
        );

      setWallet({
        ...wallet,
        balance:
          response.wallet.balance,
      });

      setSuccess(
        `${formatMoney(
          response.amount,
          response.currency,
        )} added successfully.`,
      );

      setAmount('');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Deposit failed',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <section className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Add Money
            </h1>

            <p className="mt-2 text-slate-500">
              Add test funds to your Payflow wallet.
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
          <aside className="rounded-3xl bg-gradient-to-br from-emerald-500 to-green-700 p-7 text-white shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-100">
              Current Balance
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

            <p className="mt-6 break-all text-sm text-emerald-100">
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
            onSubmit={handleDeposit}
            className="rounded-3xl bg-white p-7 shadow-sm"
          >
            <div>
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
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="reference"
                className="text-sm font-semibold text-slate-700"
              >
                Reference
              </label>

              <input
                id="reference"
                value={reference}
                onChange={(event) =>
                  setReference(
                    event.target.value,
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              This is a development deposit. It does not charge a real card or UPI account.
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                isLoading ||
                !wallet
              }
              className="mt-6 w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Adding Money...'
                : 'Add Money'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}