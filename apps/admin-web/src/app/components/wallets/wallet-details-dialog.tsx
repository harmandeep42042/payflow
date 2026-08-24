'use client';

import { useEffect, useRef } from 'react';
import { Button, CloseIcon, IconButton, StatusBadge } from '../ui';
import { formatWalletBalance, formatWalletDate, getWalletOwnerName, isZeroBalance } from './helpers';
import type { AdminWallet, WalletStatus } from './types';

export function WalletDetailsDialog({ open, wallet, onClose, onStatus, returnFocus }: {
  open: boolean; wallet: AdminWallet | null; onClose: () => void;
  onStatus: (status: WalletStatus) => void; returnFocus: HTMLButtonElement | null;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = previousOverflow; returnFocus?.focus(); };
  }, [open, onClose, returnFocus]);
  if (!open || !wallet) return null;
  const counts = wallet.counts;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="wallet-details-title" className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div><h2 id="wallet-details-title" className="text-lg font-semibold text-slate-950">Wallet details</h2><p className="mt-1 text-sm text-slate-500">Account information and transaction counts</p></div>
          <IconButton ref={closeRef} aria-label="Close wallet details" onClick={onClose}><CloseIcon className="size-5" /></IconButton>
        </header>
        <div className="overflow-y-auto p-4 sm:p-6">
          <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</p><h3 className="mt-2 text-xl font-semibold text-slate-950">{getWalletOwnerName(wallet)}</h3><p className="mt-1 text-sm text-slate-600">{wallet.user.email}</p><p className="text-sm text-slate-500">{wallet.user.phone ?? 'No phone provided'}</p></div><StatusBadge status={wallet.status} /></div>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">Currency</dt><dd className="mt-1 font-medium text-slate-800">{wallet.currency}</dd></div>
                <div><dt className="text-xs text-slate-500">Balance</dt><dd className="mt-1 font-semibold text-slate-950 tabular-nums">{formatWalletBalance(wallet.balance, wallet.currency)}</dd></div>
                <div><dt className="text-xs text-slate-500">Created</dt><dd className="mt-1 text-slate-800 tabular-nums">{formatWalletDate(wallet.createdAt, true)}</dd></div>
                <div><dt className="text-xs text-slate-500">Updated</dt><dd className="mt-1 text-slate-800 tabular-nums">{formatWalletDate(wallet.updatedAt, true)}</dd></div>
                <div><dt className="text-xs text-slate-500">Version</dt><dd className="mt-1 text-slate-800 tabular-nums">{wallet.version ?? 'Unavailable'}</dd></div>
                <div><dt className="text-xs text-slate-500">Owner status</dt><dd className="mt-1"><StatusBadge status={wallet.user.status} /></dd></div>
              </dl>
              <div className="mt-4"><p className="text-xs text-slate-500">Wallet ID</p><code className="mt-1 block break-all text-xs text-slate-700">{wallet.id}</code></div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status management</p>
              {wallet.status === 'CLOSED' ? <p className="mt-4 text-sm text-slate-500">Closed wallets are read-only and cannot be reactivated.</p> : <div className="mt-4 flex flex-wrap gap-2">{wallet.status === 'ACTIVE' ? <Button size="sm" variant="secondary" onClick={() => onStatus('FROZEN')}>Freeze wallet</Button> : <Button size="sm" onClick={() => onStatus('ACTIVE')}>Activate wallet</Button>}<Button size="sm" variant="danger" onClick={() => onStatus('CLOSED')}>Close wallet</Button></div>}
              {wallet.status !== 'CLOSED' ? <p className="mt-3 text-xs text-slate-500">Closing is irreversible. The backend permits it only when the wallet balance is exactly zero.{!isZeroBalance(wallet.balance) ? ' This wallet currently has a non-zero balance.' : ''}</p> : null}
              <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ledger account</p>{wallet.ledgerAccount ? <dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-xs text-slate-500">Name / code</dt><dd className="text-slate-800">{wallet.ledgerAccount.name} · {wallet.ledgerAccount.code}</dd></div><div><dt className="text-xs text-slate-500">Type / status</dt><dd className="text-slate-800">{wallet.ledgerAccount.type} · {wallet.ledgerAccount.status}</dd></div></dl> : <p className="mt-3 text-sm text-slate-500">No ledger account available.</p>}</div>
            </div>
          </section>
          <section className="mt-5 rounded-lg border border-slate-200 p-4"><h3 className="text-base font-semibold text-slate-900">Transaction counts</h3><dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">{[['Deposits', counts.deposits], ['Withdrawals', counts.withdrawals], ['Outgoing', counts.outgoingTransfers], ['Incoming', counts.incomingTransfers], ['Total', wallet.transactionCount]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{value}</dd></div>)}</dl><p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">These are account-level transaction counts, not complete transaction history.</p></section>
        </div>
      </div>
    </div>
  );
}
