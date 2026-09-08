'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  getStoredUser,
  userAuthenticatedRequest,
} from '../lib/api';

type Contact = {
  id: string;
  nickname?: string | null;
  favourite: boolean;
  recipient: {
    id: string;
    firstName: string;
    lastName?: string | null;
    vpa?: string | null;
  };
};

type Wallet = {
  id: string;
  userId: string;
  currency: string;
  status: string;
};

type Counterparty = {
  walletId: string;
  userId: string;
  firstName: string;
  lastName?: string | null;
  email: string;
};

type WalletTransaction = {
  id?: string;
  status?: string;
  createdAt: string;
  sourceWalletId?: string | null;
  destinationWalletId?: string | null;
  counterparty?: Counterparty | null;
};

type TransactionHistoryResponse =
  | WalletTransaction[]
  | {
      transactions?: WalletTransaction[];
      items?: WalletTransaction[];
      data?: WalletTransaction[];
    };

type RecentRecipient = {
  contactId: string;
  recipientUserId: string;
  name: string;
  vpa: string;
  favourite: boolean;
  lastActivityAt: string;
};

function readTransactions(
  value: TransactionHistoryResponse,
): WalletTransaction[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value.transactions)) {
    return value.transactions;
  }

  if (Array.isArray(value.items)) {
    return value.items;
  }

  if (Array.isArray(value.data)) {
    return value.data;
  }

  return [];
}

function contactName(contact: Contact): string {
  const nickname = contact.nickname?.trim();

  if (nickname) {
    return nickname;
  }

  const fullName = [
    contact.recipient.firstName,
    contact.recipient.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || 'Saved recipient';
}

function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'PF';
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

function usableTransactionStatus(status?: string): boolean {
  if (!status) {
    return true;
  }

  const normalized = status.trim().toUpperCase();

  return (
    normalized === 'COMPLETED' ||
    normalized === 'SUCCESS' ||
    normalized === 'SUCCEEDED'
  );
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRecentActivity(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently paid';
  }

  return `Last paid ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)}`;
}
export default function RecentRecipients() {
  const [items, setItems] = useState<RecentRecipient[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadRecentRecipients(): Promise<void> {
      const user = getStoredUser();

      if (!user?.id) {
        if (active) {
          setItems([]);
        }

        return;
      }

      setError('');

      try {
        const [contacts, walletResponse] = await Promise.all([
          userAuthenticatedRequest<Contact[]>(
            '/customer-features/contacts',
          ),
          userAuthenticatedRequest<
            Wallet[] | { wallets?: Wallet[] }
          >(`/wallets/user/${user.id}`),
        ]);

        const wallets = Array.isArray(walletResponse)
          ? walletResponse
          : walletResponse.wallets ?? [];

        if (wallets.length === 0) {
          if (active) {
            setItems([]);
          }

          return;
        }

        const historyResponses = await Promise.all(
          wallets.map((wallet) =>
            userAuthenticatedRequest<TransactionHistoryResponse>(
              `/wallets/${wallet.id}/transactions?page=1&limit=100&type=ALL`,
            ),
          ),
        );

        const walletIds = new Set(
          wallets.map((wallet) => wallet.id),
        );

        const savedContactsByRecipient = new Map(
          contacts.map((contact) => [
            contact.recipient.id,
            contact,
          ]),
        );

        const history = historyResponses
          .flatMap(readTransactions)
          .sort(
            (left, right) =>
              timestamp(right.createdAt) -
              timestamp(left.createdAt),
          );

        const seen = new Set<string>();
        const recent: RecentRecipient[] = [];

        for (const transaction of history) {
          if (recent.length >= 6) {
            break;
          }

          if (
            !transaction.sourceWalletId ||
            !walletIds.has(transaction.sourceWalletId)
          ) {
            continue;
          }

          if (!usableTransactionStatus(transaction.status)) {
            continue;
          }

          const counterparty = transaction.counterparty;

          if (!counterparty?.userId) {
            continue;
          }

          if (seen.has(counterparty.userId)) {
            continue;
          }

          const contact =
            savedContactsByRecipient.get(counterparty.userId);

          const vpa = contact?.recipient.vpa?.trim();

          if (!contact || !vpa) {
            continue;
          }

          seen.add(counterparty.userId);

          recent.push({
            contactId: contact.id,
            recipientUserId: contact.recipient.id,
            name: contactName(contact),
            vpa,
            favourite: contact.favourite,
            lastActivityAt: transaction.createdAt,
          });
        }

        if (active) {
          setItems(recent);
        }
      } catch (reason) {
        if (!active) {
          return;
        }

        setItems([]);
        setError(
          reason instanceof Error
            ? reason.message
            : 'Unable to load recent recipients.',
        );
      }
    }

    void loadRecentRecipients();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      aria-labelledby="recent-recipients-heading"
      className="mt-7"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Quick pay
          </p>

          <h2
            id="recent-recipients-heading"
            className="mt-1 text-xl font-bold text-slate-950"
          >
            Recent recipients
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Saved recipients from your latest completed outgoing
            wallet activity.
          </p>
        </div>

        <Link
          href="/send-money"
          className="mt-2 inline-flex min-h-11 touch-manipulation items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:mt-0"
        >
          Pay someone else
        </Link>
      </div>

      {items === null ? (
        <div
          aria-busy="true"
      aria-label="Loading recent recipients"
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : error ? (
    <div
      role="status"
      className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5"
    >
      <p className="font-semibold text-amber-900">
        Recent recipients unavailable
      </p>

      <p className="mt-1 text-sm text-amber-800">
        Your saved contacts are still available below. You can
        continue paying them normally.
      </p>
    </div>
  ) : items.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {items.map((item) => (
            <Link
              key={item.recipientUserId}
              href={`/send-money?vpa=${encodeURIComponent(item.vpa)}`}
              aria-label={`Pay ${item.name}`}
              className="group min-h-36 touch-manipulation rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-11 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
                  {initials(item.name)}
                </span>

                {item.favourite ? (
                  <span
                    title="Favourite"
                    className="text-sm text-amber-500"
                    aria-hidden="true"
                  >
                    ★
                  </span>
                ) : null}
              </div>

              <p className="mt-3 truncate font-bold text-slate-950">
                {item.name}
              </p>

              <p className="mt-1 truncate text-xs text-slate-500">
                {item.vpa}
              </p>
          <p className="mt-2 text-xs text-slate-500">
            {formatRecentActivity(item.lastActivityAt)}
          </p>

              <p className="mt-3 text-xs font-semibold text-blue-700">
                Pay again
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-5">
          <p className="font-semibold text-slate-800">
            No recent saved recipients yet
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Completed outgoing payments to saved contacts will appear
            here automatically.
          </p>
        </div>
      )}
    </section>
  );
}