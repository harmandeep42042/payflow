'use client';

import { useCallback, useEffect, useState } from 'react';
import { userAuthenticatedRequest } from '../../lib/api';
import { Button, Card, EmptyState, ErrorState, LoadingState, PageContainer, PageHeader, StatusBadge } from '../customer';

type RecordValue = string | number | boolean | null | undefined;
type FeatureRecord = Record<string, RecordValue> & { id?: string; status?: string };

export function FeatureCollection({ title, description, endpoint, empty, providerNotice, action }: {
  title: string; description: string; endpoint: string; empty: string; providerNotice?: string;
  action?: { label: string; path: (item: FeatureRecord) => string; visible?: (item: FeatureRecord) => boolean };
}) {
  const [items, setItems] = useState<FeatureRecord[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const value = await userAuthenticatedRequest<FeatureRecord[] | { outgoing?: FeatureRecord[]; incoming?: FeatureRecord[] }>(`/customer-features${endpoint}`);
      setItems(Array.isArray(value) ? value : [...(value.outgoing ?? []), ...(value.incoming ?? [])]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load this service'); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function runAction(item: FeatureRecord) {
    if (!item.id || !action) return;
    setMessage(''); setError('');
    try {
      await userAuthenticatedRequest(`/customer-features${action.path(item)}`, { method: 'POST', body: '{}' });
      setMessage(`${action.label} completed.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Action failed'); }
  }
  return <main><PageContainer>
    <PageHeader eyebrow="Services" title={title} description={description} />
    {providerNotice ? <p role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{providerNotice}</p> : null}
    <div aria-live="polite" className="mt-4">{message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}</div>
    <div className="mt-6">{error ? <ErrorState message={error} onRetry={() => void load()} /> : items === null ? <LoadingState /> : items.length === 0 ? <EmptyState title={empty} description="New activity will appear here after it is created through Payflow." /> : <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item, index) => <Card key={item.id ?? index} className="min-w-0 p-5">
        <div className="flex items-start justify-between gap-3"><h2 className="break-words font-bold text-slate-950">{String(item.title ?? item.nickname ?? item.merchant ?? item.category ?? `Record ${index + 1}`)}</h2>{item.status ? <StatusBadge status={item.status} /> : null}</div>
        <dl className="mt-4 space-y-2 text-sm">{Object.entries(item).filter(([key, value]) => value != null && !['id', 'title', 'status'].includes(key) && typeof value !== 'object').slice(0, 7).map(([key, value]) => <div key={key} className="flex justify-between gap-4"><dt className="text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="break-all text-right font-medium text-slate-800">{String(value)}</dd></div>)}</dl>
        {action && (!action.visible || action.visible(item)) ? <Button className="mt-5" onClick={() => void runAction(item)}>{action.label}</Button> : null}
      </Card>)}
    </div>}</div>
  </PageContainer></main>;
}
