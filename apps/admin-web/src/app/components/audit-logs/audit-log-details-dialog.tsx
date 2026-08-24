'use client';

import { useEffect, useRef } from 'react';
import { Button, CloseIcon, IconButton } from '../ui';
import { AuditActionBadge } from './audit-logs-table';
import { formatAuditDate, metadataText } from './helpers';
import type { AuditLogItem } from './types';

export function AuditLogDetailsDialog(props: {
  open: boolean; log: AuditLogItem | null; onClose: () => void;
  returnFocus: HTMLButtonElement | null;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!props.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); props.onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])');
      if (!controls?.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      props.returnFocus?.focus();
    };
  }, [props.open, props.onClose, props.returnFocus]);
  if (!props.open || !props.log) return null;
  const log = props.log;
  const fields = [
    ['Timestamp', formatAuditDate(log.createdAt)], ['Audit log ID', log.id],
    ['Actor email', log.actorEmail ?? 'System/Unknown'], ['Actor user ID', log.actorUserId ?? 'No actor ID'],
    ['Target type', log.targetType], ['Target ID', log.targetId ?? 'No target ID'],
    ['IP address', log.ipAddress ?? 'Not recorded'], ['User agent', log.userAgent ?? 'Not recorded'],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="audit-details-title" aria-describedby="audit-details-description" className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6"><div><h2 id="audit-details-title" className="text-lg font-semibold text-slate-950">Audit event details</h2><p id="audit-details-description" className="mt-1 text-sm text-slate-500">Security and compliance event information</p></div><IconButton ref={closeRef} aria-label="Close audit event details" onClick={props.onClose}><CloseIcon className="size-5" /></IconButton></header>
        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center gap-3"><AuditActionBadge action={log.action} /><code className="break-all text-xs text-slate-500">{log.action}</code></div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-all text-sm text-slate-800">{value}</dd></div>)}</dl>
          <section className="mt-5 rounded-lg border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-900">Description</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{log.description ?? 'No description'}</p></section>
          <details className="mt-5 rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Safe metadata</summary><p className="mt-3 text-xs font-medium text-amber-800">Metadata is redacted for security.</p>{log.metadata?.truncated ? <p className="mt-2 text-xs text-amber-800">Metadata truncated for safety.</p> : null}<pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-xs text-slate-700">{metadataText(log.metadata)}</pre></details>
        </div>
        <footer className="flex justify-end border-t border-slate-200 px-4 py-3 sm:px-6"><Button variant="secondary" onClick={props.onClose}>Close</Button></footer>
      </div>
    </div>
  );
}
