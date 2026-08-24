'use client';

import { useEffect, useRef } from 'react';
import { Alert, Button } from '../ui';
import { formatWalletBalance, isZeroBalance } from './helpers';
import type { AdminWallet, WalletStatus } from './types';

export function WalletStatusConfirmDialog({ wallet, status, open, isUpdating, error, onCancel, onConfirm }: {
  wallet: AdminWallet | null; status: WalletStatus | null; open: boolean; isUpdating: boolean; error: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUpdating) { onCancel(); return; }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previousFocus?.focus(); };
  }, [open, isUpdating, onCancel]);
  if (!open || !wallet || !status) return null;
  const closing = status === 'CLOSED';
  const action = status === 'ACTIVE' ? 'Activate' : status === 'FROZEN' ? 'Freeze' : 'Close';
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isUpdating) onCancel(); }}><section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="wallet-status-title" aria-describedby="wallet-status-description" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"><h2 id="wallet-status-title" className="text-lg font-semibold text-slate-950">{action} wallet?</h2><p id="wallet-status-description" className="mt-2 text-sm text-slate-600">Change wallet <strong>{wallet.id.slice(0, 10)}…</strong> to <strong>{status}</strong>. This operation is audit logged.</p>{closing ? <div className="mt-3 rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-900"><p className="font-semibold">Closing is irreversible.</p><p className="mt-1">The wallet must have exactly zero balance. Existing funds must be handled before closing.</p>{!isZeroBalance(wallet.balance) ? <p className="mt-2 font-medium">Current balance: {formatWalletBalance(wallet.balance, wallet.currency)}. The backend will reject this operation.</p> : null}</div> : null}{error ? <div className="mt-4"><Alert title="Status update failed">{error}</Alert></div> : null}<div className="mt-5 flex justify-end gap-2"><Button ref={cancelRef} variant="secondary" disabled={isUpdating} onClick={onCancel}>Cancel</Button><Button variant={closing || status === 'FROZEN' ? 'danger' : 'primary'} disabled={isUpdating} onClick={onConfirm}>{isUpdating ? 'Updating…' : action}</Button></div></section></div>;
}
