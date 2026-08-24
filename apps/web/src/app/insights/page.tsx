'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, EmptyState, ErrorState, LoadingState, PageContainer, PageHeader } from '../components/customer';
import { getStoredUser, hasValidUserSession, userAuthenticatedRequest } from '../lib/api';
import { formatMoney, groupCurrencyAmounts, type CurrencyAmount } from '../lib/money';
import { beginLatestRequest, isLatestRequest } from '../lib/request-sequencing';

type Wallet = { id: string; currency: string };
type Transaction = { amount: string; currency: string; direction: 'CREDIT' | 'DEBIT'; status: string };
type Summary = { credits: CurrencyAmount[]; debits: CurrencyAmount[]; count: number };

export default function InsightsPage() {
  const router = useRouter();
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const request = beginLatestRequest(requestRef);
    const user = getStoredUser();
    if (!user || !hasValidUserSession()) { router.replace('/login'); return; }
    try {
      setLoading(true); setError('');
      const value = await userAuthenticatedRequest<Wallet[] | { wallets?: Wallet[]; data?: Wallet[] }>(`/wallets/user/${user.id}`, { signal: request.controller.signal });
      if (!isLatestRequest(requestRef, request)) return;
      const wallets = Array.isArray(value) ? value : value.wallets ?? value.data ?? [];
      const groups = await Promise.all(wallets.map((wallet) => userAuthenticatedRequest<Transaction[] | { items?: Transaction[]; transactions?: Transaction[]; data?: Transaction[] }>(`/wallets/${wallet.id}/transactions?page=1&limit=100&type=ALL`, { signal: request.controller.signal })));
      if (!isLatestRequest(requestRef, request)) return;
      const items = groups.flatMap((group) => Array.isArray(group) ? group : group.items ?? group.transactions ?? group.data ?? []).filter((item) => item.status === 'COMPLETED');
      setSummary({ credits: groupCurrencyAmounts(items.filter((item) => item.direction === 'CREDIT')), debits: groupCurrencyAmounts(items.filter((item) => item.direction === 'DEBIT')), count: items.length });
    } catch (reason) {
      if (!isLatestRequest(requestRef, request)) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load spending insights');
    } finally { if (requestRef.current?.id === request.id) setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); return () => requestRef.current?.controller.abort(); }, [load]);
  return <main><PageContainer>
    <PageHeader eyebrow="Recent activity" title="Spending insights" description="Currency-separated totals from up to 100 recent transactions per wallet. These are not lifetime or statement totals." actions={<button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800">Refresh</button>} />
    {loading && !summary ? <LoadingState label="Loading recent insights" /> : error ? <div className="mt-8"><ErrorState message={error} onRetry={() => void load()} /></div> : summary ? <div className="mt-8 space-y-6">
      <div className="grid gap-5 md:grid-cols-2"><InsightCard title="Completed credits" values={summary.credits} /><InsightCard title="Completed debits" values={summary.debits} /></div>
      <Card className="p-6"><p className="text-sm font-semibold text-slate-500">Completed transactions included</p><p className="mt-2 text-3xl font-bold text-slate-950">{summary.count.toLocaleString('en-IN')}</p><p className="mt-2 text-sm text-slate-600">Pending, failed and reversed activity is excluded. No currencies are converted or combined.</p></Card>
    </div> : null}
  </PageContainer></main>;
}

function InsightCard({ title, values }: { title: string; values: CurrencyAmount[] }) {
  return <Card className="p-6"><h2 className="text-lg font-bold text-slate-950">{title}</h2>{values.length ? <dl className="mt-5 space-y-4">{values.map((value) => <div key={value.currency} className="flex items-baseline justify-between gap-4 border-t border-slate-100 pt-4 first:border-0 first:pt-0"><dt className="font-semibold text-slate-600">{value.currency}</dt><dd className="text-xl font-bold tabular-nums text-slate-950">{formatMoney(value.amount, value.currency)}</dd></div>)}</dl> : <div className="mt-5"><EmptyState title="No activity" description="No completed activity is available in the recent API window." /></div>}</Card>;
}
