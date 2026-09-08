'use client';

import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${className}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string; title: string; description?: string; actions?: ReactNode;
}) {
  return <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p> : null}
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </header>;
}

const buttonBase = 'inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const style = variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50';
  return <button className={`${buttonBase} ${style} ${className}`} {...props} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>{children}</section>;
}

export function Field({ label, hint, error, id, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-semibold text-slate-800">{label}</label><input id={id} className={`min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 ${className}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />{hint ? <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p> : null}{error ? <p id={`${id}-error`} className="text-sm font-medium text-red-700">{error}</p> : null}</div>;
}

export function SelectField({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-semibold text-slate-800">{label}</label><select id={id} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" {...props}>{children}</select></div>;
}

export function StatusBadge({ status }: { status?: string | null }) {
  const normalized = (status ?? 'UNKNOWN').toUpperCase();
  const style = ['ACTIVE', 'COMPLETED', 'SUCCESS'].includes(normalized) ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : ['PENDING', 'PROCESSING'].includes(normalized) ? 'bg-amber-50 text-amber-800 ring-amber-600/20' : ['FAILED', 'FROZEN', 'CLOSED'].includes(normalized) ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-slate-100 text-slate-700 ring-slate-500/20';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${style}`}>{normalized}</span>;
}

export function Avatar({ name }: { name?: string | null }) {
  const initials = (name ?? 'Customer').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{initials}</span>;
}

export function LoadingState({ label = 'Loadingâ€¦' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="grid gap-3 py-8"><span className="h-5 w-2/5 animate-pulse rounded bg-slate-200" /><span className="h-16 animate-pulse rounded-xl bg-slate-100" /><span className="sr-only">{label}</span></div>;
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center"><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm text-slate-600">{description}</p></div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Something went wrong</p><p className="mt-1">{message}</p>{onRetry ? <Button variant="secondary" className="mt-3" onClick={onRetry}>Try again</Button> : null}</div>;
}

export function Dialog({ open, title, description, children, onClose }: {
  open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((item) => !item.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; previousFocus.current?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="customer-dialog-title" aria-describedby={description ? 'customer-dialog-description' : undefined} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl outline-none sm:rounded-2xl"><h2 id="customer-dialog-title" className="text-xl font-bold text-slate-950">{title}</h2>{description ? <p id="customer-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}<div className="mt-6">{children}</div></div></div>;
}

export function ConfirmationDialog({ open, title, description, confirmLabel = 'Confirm', isLoading = false, onConfirm, onClose }: {
  open: boolean; title: string; description: string; confirmLabel?: string; isLoading?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return <Dialog open={open} title={title} description={description} onClose={onClose}><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button><Button onClick={onConfirm} disabled={isLoading}>{isLoading ? 'Processingâ€¦' : confirmLabel}</Button></div></Dialog>;
}
