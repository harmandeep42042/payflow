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

import {
  getRecipientPhoneShortcut,
  normalizeRecipientPhone,
} from '../lib/recipient-phone';

type Wallet = {
  id: string;
  userId: string;
  balance: string;
  currency: string;
  status: string;
};

type VerifiedQr = {
  type?: 'USER' | 'MERCHANT';
  vpa: string;
  currency: string;
  amount: string | null;
  expiresAt?: string | null;
  idempotencyKey: string;
  merchantId?: string | null;
  merchantVpa?: string | null;
  qrIdentity?: string | null;
};

type MerchantPaymentResponse = {
  id?: string;
  transfer?: {
    id?: string;
    status?: string;
    amount?: string;
  };
  merchantPayment?: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    transactionReference?: string | null;
    receiptNumber?: string | null;
    merchant?: {
      id?: string;
      displayName?: string;
      merchantVpa?: string;
    };
  };
  replayed?: boolean;
  message?: string;
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
  const shortcutRecipientVpaRef = useRef<string | null>(null);
  const recipientVerificationFormRef = useRef<HTMLFormElement | null>(null);
  const submissionLock = useRef(false);
  const qrPayloadRef =
    useRef<string | null>(null);

  const [isQrPayment, setIsQrPayment] =
    useState(false);

  const [merchantQr, setMerchantQr] =
    useState<VerifiedQr | null>(null);
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
  useEffect(() => {
    const query =
      new URLSearchParams(window.location.search);

    if (query.get("qr") !== "1") {
      return;
    }

    const payload =
      sessionStorage.getItem(
        "payflow:qr-payment-payload",
      );

    if (!payload) {
      setError(
        "QR payment session is missing. Please scan the QR again.",
      );
      return;
    }

    const verifiedPayload = payload;

    qrPayloadRef.current = verifiedPayload;
    setIsQrPayment(true);

    async function loadVerifiedQr() {
      try {
        const verified =
          await userAuthenticatedRequest<VerifiedQr>(
            `/wallet-qr/verify?payload=${encodeURIComponent(
              verifiedPayload,
            )}`,
          );

        setVpa(verified.vpa);

        const isVerifiedMerchant =
          verified.type === 'MERCHANT' &&
          Boolean(
            verified.merchantId &&
            verified.merchantVpa &&
            verified.qrIdentity,
          );

        setMerchantQr(
          isVerifiedMerchant
            ? verified
            : null,
        );

        if (verified.amount) {
          setAmount(verified.amount);
        }
      } catch (reason) {
        qrPayloadRef.current = null;
        setIsQrPayment(false);
        setMerchantQr(null);

        setError(
          reason instanceof Error
            ? reason.message
            : "QR is invalid or expired.",
        );
      }
    }

    void loadVerifiedQr();
  }, []);

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

    const shortcutPhone =
      getRecipientPhoneShortcut(
        params,
      );
    if (qrVpa) {
      if (params.get('qr') !== '1') {
        shortcutRecipientVpaRef.current = qrVpa;
      }

      setVpa(qrVpa);
    }

    if (
      !qrVpa &&
      shortcutPhone
    ) {
      shortcutRecipientVpaRef.current =
        shortcutPhone;

      setVpa(
        shortcutPhone,
      );
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
  useEffect(() => {
    const shortcutVpa =
      shortcutRecipientVpaRef.current;

    if (
      !shortcutVpa ||
      isQrPayment ||
      vpa !== shortcutVpa
    ) {
      return;
    }

    // A recipient shortcut only performs the same
    // recipient verification that the user can trigger manually.
    // It never submits or confirms a payment.
    shortcutRecipientVpaRef.current = null;
    recipientVerificationFormRef.current?.requestSubmit();
  }, [isQrPayment, vpa]);

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

      const recipientInput =
        vpa.trim();

      const recipientPhone =
        normalizeRecipientPhone(
          recipientInput,
        );

      if (recipientPhone) {
        query.set(
          'phone',
          recipientPhone,
        );
      }
      else if (recipientInput) {
        query.set(
          'vpa',
          recipientInput.toLowerCase(),
        );
      }
      else if (email.trim()) {
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
      (!recipient && !merchantQr)
    ) {
      setError(
        merchantQr
          ? 'Merchant payment details are unavailable'
          : 'Verify recipient first',
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

      let response: TransferResponse | MerchantPaymentResponse;

      if (isQrPayment) {
        const qrPayload =
          qrPayloadRef.current;

        if (!qrPayload) {
          throw new Error(
            "QR payment payload is missing. Please scan again.",
          );
        }

        response =
          await userAuthenticatedRequest<
            MerchantPaymentResponse
          >(
            "/wallet-qr/pay",
            {
              method: "POST",

              body: JSON.stringify({
                payload: qrPayload,

                description:
                  note.trim() ||
                  "QR payment",
              }),
            },
          );
      } else {
        if (!recipient) {
          throw new Error(
            'Verify recipient first',
          );
        }

        response =
          await userAuthenticatedRequest<
            TransferResponse
          >(
            "/wallets/transfer",
            {
              method: "POST",

              body: JSON.stringify({
                sourceWalletId:
                  senderWallet.id,

                destinationWalletId:
                  recipient.walletId,

                amount:
                  normalizedAmount,

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
      }

      const merchantResponse =
        merchantQr
          ? response as MerchantPaymentResponse
          : null;

      const merchantPayment =
        merchantResponse?.merchantPayment;

      const transferId =
        response.transfer?.id ??
        (!merchantQr
          ? (response as TransferResponse).id
          : undefined) ??
        merchantPayment?.transactionReference ??
        '';

      setSuccess(
        merchantPayment
          ? 'Merchant payment successful.'
          : transferId
            ? 'Money sent successfully. Transfer ID: ' + transferId
            : 'Money sent successfully.',
      );

      const paidAmount = normalizedAmount;
      const noteValue = note.trim();

      if (isQrPayment) {
        sessionStorage.removeItem(
          "payflow:qr-payment-payload",
        );

        qrPayloadRef.current = null;
        setIsQrPayment(false);
      }

      setAmount('');
      setNote('');

      if (merchantQr && merchantPayment?.id) {
        const receiptQuery =
          new URLSearchParams({
            paymentId: merchantPayment.id,
          });

        setMerchantQr(null);

        router.push(
          '/merchant-payments/receipt?' +
            receiptQuery.toString(),
        );

        return;
      }

      setMerchantQr(null);

      if (!recipient) {
        throw new Error(
          'Recipient details are unavailable',
        );
      }

      const query =
        new URLSearchParams({
          amount: paidAmount,

          recipient:
            recipient.displayName ||
            recipient.email,

          email:
            recipient.email,

          note:
            noteValue,

          transferId:
            transferId,

          status:
            response.transfer?.status ??
            'COMPLETED',
        });

      router.push(
        '/transfer-success?' +
          query.toString(),
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
        <PageHeader
          eyebrow="Payments"
          title={merchantQr ? "Pay merchant" : "Send money"}
          description={
            merchantQr
              ? "Review the verified merchant and signed payment amount before paying."
              : "Verify the recipient before entering and confirming a payment."
          }
        />

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

        {merchantQr ? (
          <section className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-7">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
              Verified Payflow merchant
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Merchant payment
            </h2>

            <p className="mt-4 text-sm text-slate-600">
              Merchant payment address
            </p>

            <p className="mt-1 break-all text-lg font-bold text-slate-900">
              {merchantQr.merchantVpa}
            </p>

            {merchantQr.amount ? (
              <div className="mt-5 rounded-xl bg-white p-4">
                <p className="text-sm text-slate-500">
                  Signed amount
                </p>

                <p className="mt-1 text-3xl font-bold text-slate-950">
                  {formatMoney(
                    merchantQr.amount,
                    merchantQr.currency,
                  )}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Server-verified QR amount. This value cannot be edited.
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <StatusBadge status="Verified" />
            </div>
          </section>
        ) : null}

        {!merchantQr ? (
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-slate-900">
            1. Verify recipient
          </h2>

          <form
            ref={recipientVerificationFormRef}
            onSubmit={verifyRecipient}
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch"
          >
            <input
              type="text"
              required
              value={vpa || email}
            readOnly={isQrPayment}
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
              placeholder="Phone, email or Payflow VPA"
              aria-label="Recipient phone, email or payment address"
              aria-describedby="recipient-identifier-help"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className="min-h-12 w-full flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-12 w-full touch-manipulation rounded-xl bg-slate-900 px-5 py-3 font-bold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isLoading
                ? 'Checking...'
                : 'Verify'}
            </button>
          </form>
          <p
            id="recipient-identifier-help"
            className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm"
          >
            Enter a mobile number with country code, email or Payflow VPA.
            Recipient verification never sends money automatically.
          </p>

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
        ) : null}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-bold text-slate-900">
            {merchantQr ? "Confirm amount" : "2. Enter amount"}
          </h2>

          <input
            type="text"
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            aria-label="Amount"
            disabled={!recipient && !merchantQr}
            value={amount}
            readOnly={isQrPayment}
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
            disabled={!recipient && !merchantQr}
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
              : merchantQr
                ? 'Review & Pay Merchant'
                : 'Review & Send Money'}
          </button>
        </section>
        <ConfirmationDialog
          open={isConfirming}
          title={merchantQr ? "Confirm merchant payment" : "Confirm payment"}
          description={recipient && senderWallet ? `Send ${formatMoney(normalizeDecimal(amount) ?? '0.00', senderWallet.currency)} to ${recipient.displayName || recipient.email}? Verify the recipient and amount before continuing.` : 'Verify the payment details before continuing.'}
          confirmLabel={merchantQr ? "Pay merchant" : "Send money"}
          isLoading={isSending}
          onClose={() => setIsConfirming(false)}
          onConfirm={() => void sendMoney(true)}
        />
      </PageContainer>
    </main>
  );
}
