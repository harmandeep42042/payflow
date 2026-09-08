'use client';

import Link from 'next/link';
import {
  Suspense,
  useEffect,
  useState,
} from 'react';
import {
  useSearchParams,
} from 'next/navigation';

import {
  userAuthenticatedRequest,
} from '../../lib/api';

type MerchantReceipt = {
  id: string;
  userId: string;
  merchantId: string;
  amount: string;
  currency: string;
  status: string;
  providerState: string;
  providerReference?: string | null;
  transactionReference: string;
  receiptNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;

  merchant: {
    id: string;
    displayName: string;
    category: string;
    merchantVpa: string;
  };

  refunds?: Array<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    reason?: string | null;
    createdAt: string;
  }>;
};

function money(
  amount: string,
  currency: string,
) {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`;
  }

  try {
    return new Intl.NumberFormat(
      'en-IN',
      {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      },
    ).format(value);
  } catch {
    return `${currency} ${amount}`;
  }
}

function dateTime(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-IN');
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '24px',
        padding: '12px 0',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <span
        style={{
          color: '#6b7280',
        }}
      >
        {label}
      </span>

      <span
        style={{
          textAlign: 'right',
          fontWeight: 600,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MerchantReceiptContent() {
  const searchParams = useSearchParams();

  const paymentId =
    searchParams.get('paymentId')?.trim() ?? '';

  const [receipt, setReceipt] =
    useState<MerchantReceipt | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    let active = true;

    async function loadReceipt() {
      if (!paymentId) {
        setError(
          'Merchant payment ID is missing.',
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const result =
          await userAuthenticatedRequest<MerchantReceipt>(
            `/customer-features/merchant-payments/${encodeURIComponent(
              paymentId,
            )}`,
          );

        if (active) {
          setReceipt(result);
        }
      } catch (requestError) {
        if (!active) {
          return;
        }

        setReceipt(null);

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load merchant receipt.',
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
  }, [paymentId]);

  if (loading) {
    return (
      <main
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '48px 20px',
        }}
      >
        <h1>Merchant receipt</h1>

        <p>
          Loading verified payment details...
        </p>
      </main>
    );
  }

  if (error || !receipt) {
    return (
      <main
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '48px 20px',
        }}
      >
        <h1>Receipt unavailable</h1>

        <p
          style={{
            color: '#b91c1c',
          }}
        >
          {error ||
            'Unable to load merchant receipt.'}
        </p>

        <p>
          This receipt can only be viewed by
          the payer or the merchant owner.
        </p>

        <Link href="/merchant-payments">
          Back to merchant payments
        </Link>
      </main>
    );
  }

  const succeeded =
    receipt.status === 'SUCCEEDED';

  const refunded =
    receipt.status === 'REFUNDED' ||
    receipt.status === 'PARTIALLY_REFUNDED';

  return (
    <main
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '40px 20px 64px',
      }}
    >
      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '20px',
          padding: '28px',
          background: '#ffffff',
          boxShadow:
            '0 10px 30px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: '28px',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              fontSize: '44px',
              marginBottom: '8px',
            }}
          >
            {succeeded ? '✓' : refunded ? '↩' : '•'}
          </div>

          <h1
            style={{
              margin: '0 0 8px',
            }}
          >
            Merchant payment receipt
          </h1>

          <p
            style={{
              margin: 0,
              color: '#6b7280',
            }}
          >
            Payflow wallet payment
          </p>

          <div
            style={{
              fontSize: '34px',
              fontWeight: 700,
              marginTop: '20px',
            }}
          >
            {money(
              receipt.amount,
              receipt.currency,
            )}
          </div>

          <p
            style={{
              marginTop: '8px',
              fontWeight: 600,
            }}
          >
            {receipt.status}
          </p>
        </div>

        <h2
          style={{
            fontSize: '18px',
            marginTop: 0,
          }}
        >
          Merchant
        </h2>

        <Row
          label="Merchant"
          value={receipt.merchant.displayName}
        />

        <Row
          label="Payment address"
          value={receipt.merchant.merchantVpa}
        />

        <Row
          label="Category"
          value={receipt.merchant.category}
        />

        <h2
          style={{
            fontSize: '18px',
            marginTop: '28px',
          }}
        >
          Payment details
        </h2>

        <Row
          label="Receipt number"
          value={
            receipt.receiptNumber ||
            'Not assigned'
          }
        />

        <Row
          label="Transaction reference"
          value={receipt.transactionReference}
        />

        <Row
          label="Payment ID"
          value={receipt.id}
        />

        <Row
          label="Status"
          value={receipt.status}
        />

        <Row
          label="Completed"
          value={dateTime(receipt.completedAt)}
        />

        <Row
          label="Created"
          value={dateTime(receipt.createdAt)}
        />

        {receipt.refunds &&
        receipt.refunds.length > 0 ? (
          <>
            <h2
              style={{
                fontSize: '18px',
                marginTop: '28px',
              }}
            >
              Refunds
            </h2>

            {receipt.refunds.map(
              (refund) => (
                <div
                  key={refund.id}
                  style={{
                    marginTop: '12px',
                    padding: '14px',
                    border:
                      '1px solid #e5e7eb',
                    borderRadius: '12px',
                  }}
                >
                  <Row
                    label="Amount"
                    value={money(
                      refund.amount,
                      refund.currency,
                    )}
                  />

                  <Row
                    label="Status"
                    value={refund.status}
                  />

                  <Row
                    label="Requested"
                    value={dateTime(
                      refund.createdAt,
                    )}
                  />

                  {refund.reason ? (
                    <Row
                      label="Reason"
                      value={refund.reason}
                    />
                  ) : null}
                </div>
              ),
            )}
          </>
        ) : null}

        <div
          style={{
            marginTop: '28px',
            padding: '14px',
            background: '#f9fafb',
            borderRadius: '12px',
            color: '#4b5563',
            fontSize: '14px',
            lineHeight: 1.6,
          }}
        >
          This receipt is generated from
          Payflow&apos;s server-side merchant
          payment record. It does not represent
          external bank or UPI settlement.
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            marginTop: '28px',
          }}
        >
          <Link href="/merchant-payments">
            Merchant payments
          </Link>

          <Link href="/">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function MerchantReceiptPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            maxWidth: '720px',
            margin: '0 auto',
            padding: '48px 20px',
          }}
        >
          <h1>Merchant receipt</h1>
          <p>Loading verified payment details...</p>
        </main>
      }
    >
      <MerchantReceiptContent />
    </Suspense>
  );
}
