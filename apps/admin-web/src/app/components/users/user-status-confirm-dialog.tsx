'use client';

import { useEffect, useRef } from 'react';
import { Alert, Button } from '../ui';
import { getUserDisplayName } from './helpers';
import type { AdminUserDetails, UserStatus } from './types';

export function UserStatusConfirmDialog({
  user,
  status,
  open,
  isUpdating,
  error,
  onCancel,
  onConfirm,
}: {
  user: AdminUserDetails | null;
  status: UserStatus | null;
  open: boolean;
  isUpdating: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUpdating) {
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
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
      previousFocus?.focus();
    };
  }, [open, isUpdating, onCancel]);
  if (!open || !user || !status) return null;
  const destructive = status === 'BLOCKED' || status === 'SUSPENDED';
  const action =
    status === 'ACTIVE'
      ? 'Activate'
      : status === 'BLOCKED'
        ? 'Block'
        : 'Suspend';
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isUpdating) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="status-confirm-title"
        aria-describedby="status-confirm-description"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h2
          id="status-confirm-title"
          className="text-lg font-semibold text-slate-950"
        >
          {action} user?
        </h2>
        <p
          id="status-confirm-description"
          className="mt-2 text-sm text-slate-600"
        >
          Change <strong>{getUserDisplayName(user)}</strong> to{' '}
          <strong>{status}</strong>. This operation is audit logged.
        </p>
        {destructive ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Active refresh sessions will be revoked. Already-issued access
            tokens are not claimed to be immediately invalidated.
          </p>
        ) : null}
        {error ? (
          <div className="mt-4">
            <Alert title="Status update failed">{error}</Alert>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="secondary"
            disabled={isUpdating}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            disabled={isUpdating}
            onClick={onConfirm}
          >
            {isUpdating ? 'Updating…' : action}
          </Button>
        </div>
      </section>
    </div>
  );
}
