'use client';

import {
  FormEvent,
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

type Recipient = {
  userId: string;
  email: string;
  displayName: string;
  walletId: string;
  currency: string;
};

type RecipientResponse = {
  recipient: Recipient;
};

type Wallet = {
  id: string;
  userId: string;
  balance: string;
  currency: string;
  status: string;
};

type TransferResponse = {
  id?: string;

  transfer?: {
    id?: string;
    status?: string;
    amount?: string;
  };

  message?: string;
};

function createIdempotencyKey():
  string {
  if (
    typeof crypto !== 'undefined' &&
    'randomUUID' in crypto
  ) {
    return crypto.randomUUID();
  }

  return `pf-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

export default function SendMoneyPage() {
  const router =
    useRouter();

  const [
    senderWallet,
    setSenderWallet,
  ] = useState<Wallet | null>(
    null,
  );

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    recipient,
    setRecipient,
  ] = useState<Recipient | null>(
    null,
  );

  const [
    amount,
    setAmount,
  ] = useState('');

  const [
    note,
    setNote,
  ] = useState('');

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    isSending,
    setIsSending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  useEffect(() => {
    async function loadWallet():
      Promise<void> {
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
        const response =
          await userAuthenticatedRequest<
            | Wallet
            | Wallet[]
            | {
                data?: Wallet;
                wallets?: Wallet[];
              }
          >(
            `/wallets/user/${user.id}`,
          );

        let resolvedWallet:
          | Wallet
          | null = null;

        if (Array.isArray(response)) {
          resolvedWallet =
            response[0] ?? null;
        }
        else if (
          response &&
          typeof response === 'object' &&
          'id' in response
        ) {
          resolvedWallet =
            response as Wallet;
        }
        else if (
          response &&
          typeof response === 'object' &&
          'data' in response
        ) {
          resolvedWallet =
            response.data ?? null;
        }
        else if (
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
            'Sender wallet not found',
          );
        }

        setSenderWallet(
          resolvedWallet,
        );
      }
      catch (
        requestError
      ) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load sender wallet',
        );
      }
    }

    void loadWallet();
  }, [
    router,
  ]);

  async function verifyRecipient(
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const user =
      getStoredUser();

    if (!user) {
      setError(
        'Please login first',
      );

      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      setRecipient(null);

      const query =
        new URLSearchParams({
          email:
            email.trim(),

          currency:
            senderWallet?.currency ??
            'INR',

          excludeUserId:
            user.id,
        });

      const response =
        await fetch(
          `/api/wallet-recipients/resolve?${query.toString()}`,
        );

      const body =
        await response.json() as
          | RecipientResponse
          | {
              message?: string;
            };

      if (!response.ok) {
        throw new Error(
          'message' in body &&
          body.message
            ? body.message
            : 'Recipient not found',
        );
      }

      setRecipient(
        (
          body as
            RecipientResponse
        ).recipient,
      );
    }
    catch (
      requestError
    ) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Recipient verification failed',
      );
    }
    finally {
      setIsLoading(false);
    }
  }

  async function sendMoney():
    Promise<void> {
    if (
      !senderWallet ||
      !recipient
    ) {
      setError(
        'Verify recipient first',
      );

      return;
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount,
      ) ||
      numericAmount <= 0
    ) {
      setError(
        'Enter a valid amount',
      );

      return;
    }

    if (
      numericAmount >
      Number(
        senderWallet.balance,
      )
    ) {
      setError(
        'Insufficient wallet balance',
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Send â‚¹${numericAmount.toFixed(
          2,
        )} to ${recipient.displayName || recipient.email}?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setIsSending(true);
      setError('');
      setSuccess('');

      const response =
        await userAuthenticatedRequest<
          TransferResponse
        >(
          '/wallets/transfer',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                sourceWalletId:
                  senderWallet.id,

                destinationWalletId:
                  recipient.walletId,

                amount:
                  numericAmount.toFixed(
                    2,
                  ),

                currency:
                  senderWallet.currency,

                description:
                  note.trim() ||
                  `Transfer to ${recipient.email}`,

                idempotencyKey:
                  createIdempotencyKey(),
              }),
          },
        );

      const transferId =
        response.transfer?.id ??
        response.id ??
        '';

      setSuccess(
        transferId
          ? `Money sent successfully. Transfer ID: ${transferId}`
          : 'Money sent successfully.',
      );

      setAmount('');
      setNote('');

      const query =
        new URLSearchParams({
          amount:
            numericAmount.toFixed(
              2,
            ),

          recipient:
            recipient.displayName ||
            recipient.email,

          email:
            recipient.email,

          note:
            note.trim(),

          transferId:
            transferId,

          status:
            response.transfer?.status ??
            'COMPLETED',
        });

      router.push(
        `/transfer-success?${query.toString()}`,
      );
    }
    catch (
      requestError
    ) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Transfer failed',
      );
    }
    finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-sky-600">
              Payflow
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Send Money
            </h1>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
          >
            Dashboard
          </Link>
        </div>

        {senderWallet ? (
          <div className="mt-8 rounded-2xl bg-sky-600 p-6 text-white">
            <p className="text-sm text-sky-100">
              Available balance
            </p>

            <p className="mt-2 text-3xl font-bold">
              â‚¹
              {Number(
                senderWallet.balance,
              ).toLocaleString(
                'en-IN',
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                },
              )}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            1. Verify recipient
          </h2>

          <form
            onSubmit={verifyRecipient}
            className="mt-5 flex gap-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(
                event,
              ) => {
                setEmail(
                  event.target.value,
                );

                setRecipient(
                  null,
                );
              }}
              placeholder="receiver@payflow.com"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              {isLoading
                ? 'Checking...'
                : 'Verify'}
            </button>
          </form>

          {recipient ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-bold text-emerald-700">
                Recipient verified
              </p>

              <p className="mt-2 text-lg font-bold text-slate-900">
                {recipient.displayName ||
                  recipient.email}
              </p>

              <p className="text-sm text-slate-600">
                {recipient.email}
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            2. Enter amount
          </h2>

          <input
            type="number"
            min="1"
            step="0.01"
            disabled={!recipient}
            value={amount}
            onChange={(
              event,
            ) =>
              setAmount(
                event.target.value,
              )
            }
            placeholder="500.00"
            className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 disabled:bg-slate-100"
          />

          <input
            type="text"
            disabled={!recipient}
            value={note}
            onChange={(
              event,
            ) =>
              setNote(
                event.target.value,
              )
            }
            placeholder="Note (optional)"
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 disabled:bg-slate-100"
          />

          <button
            type="button"
            disabled={
              !recipient ||
              !amount ||
              isSending
            }
            onClick={() =>
              void sendMoney()
            }
            className="mt-5 w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {isSending
              ? 'Sending...'
              : 'Review & Send Money'}
          </button>
        </section>
      </div>
    </main>
  );
}