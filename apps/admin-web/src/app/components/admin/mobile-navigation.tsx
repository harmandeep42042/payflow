'use client';

import { useEffect, useRef } from 'react';
import { CloseIcon, IconButton, LogoutIcon } from '../ui';
import { SidebarNavigation } from './sidebar';

export function MobileNavigation({
  open,
  onClose,
  onLogout,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  returnFocus: HTMLButtonElement | null;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [open, onClose, returnFocus]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Dismiss navigation"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
      />
      <aside
        ref={dialogRef}
        id="mobile-admin-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className="relative flex h-full w-[min(20rem,86vw)] flex-col bg-white shadow-xl"
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <span className="text-lg font-semibold text-slate-900">
            Payflow <span className="text-blue-600">Admin</span>
          </span>
          <IconButton ref={closeRef} aria-label="Close navigation" onClick={onClose}>
            <CloseIcon className="size-5" />
          </IconButton>
        </div>
        <SidebarNavigation onNavigate={onClose} />
        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogoutIcon className="size-[18px]" />
            Logout
          </button>
        </div>
      </aside>
    </div>
  );
}
