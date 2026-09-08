'use client';

import {
  getSplitBillNotificationHref,
} from '../split-bill/split-bill-deeplink';

import {
  getRequestMoneyNotificationHref,
} from '../request-money/request-money-deeplink';

import { useMemo, useState } from 'react';
import { Button, Card, ConfirmationDialog, EmptyState, ErrorState, PageContainer, PageHeader, StatusBadge } from '../components/customer';
import { useNotifications } from '../hooks/use-notifications';
import { userAuthenticatedRequest } from '../lib/api';

type PendingAction = { kind: 'delete'; id: string; title: string } | { kind: 'clear' } | null;

export default function NotificationsPage() {
  const { notifications, unreadCount, isConnected, markNotificationRead, removeNotification, clearNotifications } = useNotifications();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [saving, setSaving] = useState(false);
  const visible = useMemo(() => filter === 'UNREAD' ? notifications.filter((item) => !item.isRead) : notifications, [filter, notifications]);

  async function markRead(id: string) {
    setError(''); setMessage('');
    try { await userAuthenticatedRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }); markNotificationRead(id); setMessage('Notification marked as read.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to mark notification as read'); }
  }
  async function markAll() {
    setError(''); setMessage(''); setSaving(true);
    try { await userAuthenticatedRequest('/notifications/read-all', { method: 'PATCH' }); notifications.forEach((item) => markNotificationRead(item.id)); setMessage('All notifications marked as read.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to mark all notifications as read'); }
    finally { setSaving(false); }
  }
  async function confirmAction() {
    if (!pending) return;
    setError(''); setMessage(''); setSaving(true);
    try {
      if (pending.kind === 'clear') { await userAuthenticatedRequest('/notifications', { method: 'DELETE' }); clearNotifications(); setMessage('Notification history cleared.'); }
      else { await userAuthenticatedRequest(`/notifications/${encodeURIComponent(pending.id)}`, { method: 'DELETE' }); removeNotification(pending.id); setMessage('Notification deleted.'); }
      setPending(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update notification history'); }
    finally { setSaving(false); }
  }

  return <main><PageContainer className="max-w-5xl">
    <PageHeader eyebrow="Activity" title="Notifications" description="Persistent account, payment and support updates. Real-time events use the existing authenticated Payflow connection." actions={<Button variant="secondary" onClick={() => void markAll()} disabled={saving || unreadCount === 0}>Mark all read</Button>} />
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-700"><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />{isConnected ? 'Real-time connected' : 'Real-time reconnecting'} · {unreadCount} unread</p>
      <div className="flex gap-2"><Button variant={filter === 'ALL' ? 'primary' : 'secondary'} onClick={() => setFilter('ALL')}>All</Button><Button variant={filter === 'UNREAD' ? 'primary' : 'secondary'} onClick={() => setFilter('UNREAD')}>Unread</Button>{notifications.length ? <Button variant="danger" onClick={() => setPending({ kind: 'clear' })}>Clear history</Button> : null}</div>
    </div>
    <div aria-live="polite" className="mt-4 space-y-3">{message ? <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</p> : null}{error ? <ErrorState message={error} /> : null}</div>
    <section aria-label="Notification history" className="mt-6 space-y-3">
      {visible.length === 0 ? <EmptyState title={filter === 'UNREAD' ? 'You are all caught up' : 'No notifications yet'} description="Payment, request, split, offer, AutoPay and support updates will appear here." /> : visible.map((item) => <Card key={item.id} className={`p-5 ${item.isRead ? '' : 'border-blue-200 bg-blue-50/40'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-950">{item.title}</h2><StatusBadge status={item.isRead ? 'READ' : 'UNREAD'} /></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.message}</p><p className="mt-3 text-xs font-semibold text-slate-500">{new Date(item.createdAt).toLocaleString('en-IN')}</p></div><div className="flex shrink-0 flex-wrap gap-2">{getSplitBillNotificationHref(item) ? <a href={getSplitBillNotificationHref(item) ?? undefined} className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto">View split</a> : null}{getRequestMoneyNotificationHref(item.metadata) ? <a href={getRequestMoneyNotificationHref(item.metadata) ?? '/request-money'} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">View request</a> : null}{!item.isRead ? <Button variant="secondary" onClick={() => void markRead(item.id)}>Mark read</Button> : null}<Button variant="danger" onClick={() => setPending({ kind: 'delete', id: item.id, title: item.title })}>Delete</Button></div></div>
      </Card>)}
    </section>
    <ConfirmationDialog open={pending !== null} title={pending?.kind === 'clear' ? 'Clear notification history?' : 'Delete notification?'} description={pending?.kind === 'delete' ? `Delete “${pending.title}”? This cannot be undone.` : 'This removes all persistent notification history from your account.'} confirmLabel={pending?.kind === 'clear' ? 'Clear history' : 'Delete'} isLoading={saving} onConfirm={() => void confirmAction()} onClose={() => setPending(null)} />
  </PageContainer></main>;
}
