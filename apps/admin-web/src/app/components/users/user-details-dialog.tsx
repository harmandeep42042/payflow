'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  CloseIcon,
  IconButton,
  Skeleton,
  StatusBadge,
} from '../ui';
import {
  formatCurrencyAmount,
  formatUserDate,
  formatUserMoney,
  getUserDisplayName,
  getWalletBalances,
} from './helpers';
import type { AdminUserDetails, UserStatus } from './types';

export function UserDetailsDialog({
  open,
  user,
  isLoading,
  error,
  onClose,
  onRetry,
  onStatus,
  returnFocus,
}: {
  open: boolean;
  user: AdminUserDetails | null;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onRetry: () => void;
  onStatus: (status: UserStatus) => void;
  returnFocus: HTMLButtonElement | null;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const balances = getWalletBalances(user?.wallets);
  const wallets = Array.isArray(user?.wallets) ? user.wallets : [];

  async function copyUserId() {
    if (!user) return;
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(user.id);
      setCopyFeedback('User ID copied.');
    } catch {
      setCopyFeedback('Unable to copy user ID. Select and copy it manually.');
    }
  }

  useEffect(() => {
    if (open) setCopyFeedback('');
  }, [open, user?.id]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [open, onClose, returnFocus]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-details-title"
        aria-busy={isLoading}
        className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <h2
              id="user-details-title"
              className="text-lg font-semibold text-slate-950"
            >
              User details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Identity, wallets and account controls
            </p>
          </div>
          <IconButton
            ref={closeRef}
            aria-label="Close user details"
            onClick={onClose}
          >
            <CloseIcon className="size-5" />
          </IconButton>
        </header>
        <div className="overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-40" />
              <Skeleton className="h-52" />
            </div>
          ) : error && !user ? (
            <div className="py-10">
              <Alert
                action={
                  <Button variant="secondary" size="sm" onClick={onRetry}>
                    Try again
                  </Button>
                }
              >
                Unable to load user details: {error}
              </Alert>
            </div>
          ) : user ? (
            <>
              <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        User identity
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">
                        {getUserDisplayName(user)}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {user.email}
                      </p>
                      <p className="text-sm text-slate-500">
                        {user.phone ?? 'No phone provided'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {user.role}
                      </span>
                      <StatusBadge status={user.status} />
                    </div>
                  </div>
                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">Created</dt>
                      <dd className="mt-1 text-slate-800 tabular-nums">
                        {formatUserDate(user.createdAt, true)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Updated</dt>
                      <dd className="mt-1 text-slate-800 tabular-nums">
                        {formatUserDate(user.updatedAt, true)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <p className="text-xs text-slate-500">User ID</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="min-w-0 break-all text-xs text-slate-700">
                        {user.id}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void copyUserId()}
                      >
                        Copy
                      </Button>
                    </div>
                    <p
                      className="mt-1 text-xs text-slate-500"
                      aria-live="polite"
                    >
                      {copyFeedback}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Wallet overview
                  </p>
                  <div className="mt-3 space-y-1 text-2xl font-semibold text-slate-950 tabular-nums">
                    {balances.length ? (
                      balances.map((balance) => (
                        <p key={balance.currency}>
                          {formatCurrencyAmount(
                            balance.currency,
                            balance.amount,
                          )}
                        </p>
                      ))
                    ) : (
                      <p className="text-slate-400">Unavailable</p>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {wallets.length} wallet{wallets.length === 1 ? '' : 's'}
                  </p>
                  {user.role === 'USER' ? (
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <p className="text-xs font-medium text-slate-500">
                        Account status
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(
                          ['ACTIVE', 'SUSPENDED', 'BLOCKED'] as UserStatus[]
                        ).map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={
                              status === 'BLOCKED' ? 'danger' : 'secondary'
                            }
                            disabled={user.status === status}
                            onClick={() => onStatus(status)}
                          >
                            {status === 'ACTIVE'
                              ? 'Activate'
                              : status === 'SUSPENDED'
                                ? 'Suspend'
                                : 'Block'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-5 border-t border-slate-200 pt-4 text-sm text-slate-500">
                      Admin account status cannot be changed here.
                    </p>
                  )}
                </div>
              </section>
              {error ? (
                <div className="mt-4">
                  <Alert>{error}</Alert>
                </div>
              ) : null}
              <section className="mt-5">
                <h3 className="text-base font-semibold text-slate-900">
                  Wallets
                </h3>
                {wallets.length ? (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[760px] text-left text-[13px]">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th scope="col" className="px-4 py-3">
                            Wallet
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Ledger account
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Status
                          </th>
                          <th scope="col" className="px-4 py-3 text-right">
                            Balance
                          </th>
                          <th scope="col" className="px-4 py-3 text-right">
                            Transactions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {wallets.map((wallet) => (
                          <tr key={wallet.id}>
                            <th scope="row" className="px-4 py-3">
                              <p className="font-medium text-slate-800">
                                {wallet.currency}
                              </p>
                              <p
                                className="max-w-40 truncate text-xs font-normal text-slate-400"
                                title={wallet.id}
                              >
                                {wallet.id}
                              </p>
                            </th>
                            <td className="px-4 py-3">
                              <p className="text-slate-700">
                                {wallet.ledgerAccount?.name ?? 'Unavailable'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {wallet.ledgerAccount?.code ?? '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={wallet.status} />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              {wallet.currency}{' '}
                              {formatUserMoney(wallet.balance)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {wallet.transactionCounts?.total ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-slate-200 py-10 text-center text-sm text-slate-500">
                    No wallets found.
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
