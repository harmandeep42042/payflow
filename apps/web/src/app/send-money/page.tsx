'use client';

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  getStoredUser,
  hasValidUserSession,
  userAuthenticatedRequest,
} from '../lib/api';
import { compareDecimalStrings, formatMoney, normalizeDecimal } from '../lib/money';
import { acquireMutationLock, releaseMutationLock } from '../lib/mutation-lock';
import { beginLatestRequest, isLatestRequest, type ActiveRequest } from '../lib/request-sequencing';
import { ConfirmationDialog, ErrorState, PageContainer, PageHeader, StatusBadge } from '../components/customer';

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
  const recipientRequestRef = useRef<ActiveRequest | null>(null);
  const submissionLock = useRef(false);
  const [isConfirming, setIsConfirming] = useState(false);

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
    vpa,
    setVpa,
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
    const params =
      new URLSearchParams(
        window.location.search,
      );

    const qrVpa =
      params
        .get('vpa')
        ?.trim()
        .toLowerCase();

    if (qrVpa) {
      setVpa(qrVpa);
    }

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

    const request = beginLatestRequest(recipientRequestRef);
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      setRecipient(null);

      const query =
        new URLSearchParams({
          currency:
            senderWallet?.currency ??
            'INR',

          excludeUserId:
            user.id,
        });

      if (vpa.trim()) {
        query.set(
          'vpa',
          vpa.trim().toLowerCase(),
        );
      }
      else {
        query.set(
          'email',
          email.trim(),
        );
      }

      const body = await userAuthenticatedRequest<RecipientResponse>(
        `/wallets/wallet-recipients/resolve?${query.toString()}`,
        { signal: request.controller.signal },
      );

      if (!isLatestRequest(recipientRequestRef, request)) return;
      setRecipient(body.recipient);
    }
    catch (
      requestError
    ) {
      if (!isLatestRequest(recipientRequestRef, request)) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Recipient verification failed',
      );
    }
    finally {
      if (recipientRequestRef.current?.id === request.id) setIsLoading(false);
    }
  }

  useEffect(() => () => recipientRequestRef.current?.controller.abort(), []);

  async function sendMoney(confirmed = false):
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

    const normalizedAmount = normalizeDecimal(amount);

    if (
      !normalizedAmount || compareDecimalStrings(normalizedAmount, '0.00') <= 0
    ) {
      setError(
        'Enter a valid amount',
      );

      return;
    }

    if (
      compareDecimalStrings(normalizedAmount, senderWallet.balance) > 0
    ) {
      setError(
        'Insufficient wallet balance',
      );

      return;
    }

    if (!confirmed) {
      setIsConfirming(true);
      return;
    }

    setIsConfirming(false);

    if (!acquireMutationLock(submissionLock)) return;
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

                amount: normalizedAmount,

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
          amount: normalizedAmount,

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
      releaseMutationLock(submissionLock);
      setIsSending(false);
    }
  }

  return (
    <main>
      <PageContainer className="max-w-2xl">
        <PageHeader eyebrow="Payments" title="Send money" description="Verify the recipient before entering and confirming a payment." />

        {senderWallet ? (
          <div className="mt-7 rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-sm text-slate-300">
              Available balance
            </p>

            <p className="mt-2 text-3xl font-bold">
              {formatMoney(senderWallet.balance, senderWallet.currency)}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6"><ErrorState message={error} /></div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-slate-900">
            1. Verify recipient
          </h2>

          <form
            onSubmit={verifyRecipient}
            className="mt-5 flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              required
              value={vpa || email}
              onChange={(
                event,
              ) => {
                const value =
                  event.target.value;

                setEmail('');
                setVpa(value);

                setRecipient(
                  null,
                );
              }}
              placeholder="receiver@payflow.com or vpademo@payflow"
              aria-label="Recipient email or payment address"
              className="min-h-12 flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-12 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50"
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
              <div className="mt-3"><StatusBadge status="Verified" /></div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-slate-900">
            2. Enter amount
          </h2>

          <input
            type="text"
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            aria-label="Amount"
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
            className="mt-5 min-h-14 w-full rounded-xl border border-slate-300 px-4 py-3 text-2xl font-bold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
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
            aria-label="Description"
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
              void sendMoney(false)
            }
            className="mt-5 w-full rounded-xl bg-sky-500 px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {isSending
              ? 'Sending...'
              : 'Review & Send Money'}
          </button>
        </section>
        <ConfirmationDialog
          open={isConfirming}
          title="Confirm payment"
          description={recipient && senderWallet ? `Send ${formatMoney(normalizeDecimal(amount) ?? '0.00', senderWallet.currency)} to ${recipient.displayName || recipient.email}? Verify the recipient and amount before continuing.` : 'Verify the payment details before continuing.'}
          confirmLabel="Send money"
          isLoading={isSending}
          onClose={() => setIsConfirming(false)}
          onConfirm={() => void sendMoney(true)}
        />
      </PageContainer>
    </main>
  );
}
