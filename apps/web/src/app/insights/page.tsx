'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from '../components/customer';
import { userAuthenticatedRequest } from '../lib/api';
import { formatMoney } from '../lib/money';
import { beginLatestRequest, isLatestRequest } from '../lib/request-sequencing';

type CurrencyInsight = {
  currency: string;
  incoming: string;
  outgoing: string;
  successfulCount: number;
  failedOrCancelledCount: number;
  averageAmount: string;
  largestAmount: string;
  trend: Array<{ date: string; incoming: string; outgoing: string }>;
};
type Activity = {
  id: string;
  type: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
};
type Insights = {
  range: { from: string; to: string };
  transactionCount: number;
  currencies: CurrencyInsight[];
  recent: Activity[];
  categoriesAvailable: boolean;
  categoryTotals: Array<{
    category: string;
    currencies: Array<{ currency: string; amount: string }>;
  }>;
  typeBreakdown: Array<{ type: string; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
};
type Range =
  | { kind: 'preset'; days: 1 | 7 | 30 | 90 }
  | { kind: 'custom'; from: string; to: string };

export default function InsightsPage() {
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(
    null,
  );
  const [range, setRange] = useState<Range>({ kind: 'preset', days: 30 });
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [category, setCategory] = useState('');
  const [summary, setSummary] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const request = beginLatestRequest(requestRef);
    setLoading(true);
    setError('');
    const query = `${range.kind === 'preset' ? `days=${range.days}` : `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}${category ? `&category=${category}` : ''}`;
    try {
      const value = await userAuthenticatedRequest<Insights>(
        `/customer-features/insights?${query}`,
        { signal: request.controller.signal },
      );
      if (isLatestRequest(requestRef, request)) setSummary(value);
    } catch (reason) {
      if (isLatestRequest(requestRef, request))
        setError(
          reason instanceof Error ? reason.message : 'Unable to load insights',
        );
    } finally {
      if (requestRef.current?.id === request.id) setLoading(false);
    }
  }, [range, category]);
  useEffect(() => {
    void load();
    return () => requestRef.current?.controller.abort();
  }, [load]);
  function applyCustom() {
    if (!customFrom || !customTo) {
      setError('Choose both custom range dates.');
      return;
    }
    setRange({ kind: 'custom', from: customFrom, to: customTo });
  }
  return (
    <main>
      <PageContainer>
        <PageHeader
          eyebrow="Activity"
          title="Insights"
          description="Exact, currency-separated insights from your wallet activity. Payflow never combines currencies or invents conversion rates."
          actions={
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Refresh
            </button>
          }
        />
        <Card className="mt-6 p-5">
          <fieldset>
            <legend className="text-sm font-bold text-slate-800">
              Date range and category
            </legend>
            <label className="mt-3 block max-w-xs text-sm font-semibold">
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3">
                <option value="">All activity</option>
                {['FOOD','SHOPPING','TRAVEL','BILLS','RECHARGE','TRANSFER','RENT','ENTERTAINMENT','OTHER'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {([1, 7, 30, 90] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={range.kind === 'preset' && range.days === days}
                  onClick={() => setRange({ kind: 'preset', days })}
                  className="min-h-11 rounded-xl border px-4 text-sm font-bold aria-pressed:border-blue-700 aria-pressed:bg-blue-50"
                >
                  {days === 1 ? 'Today' : `${days} days`}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm font-semibold">
                From
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border px-3"
                />
              </label>
              <label className="text-sm font-semibold">
                To
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border px-3"
                />
              </label>
              <button
                type="button"
                onClick={applyCustom}
                className="min-h-11 self-end rounded-xl bg-slate-950 px-5 font-bold text-white"
              >
                Apply custom
              </button>
            </div>
          </fieldset>
        </Card>
        <div aria-live="polite">
          {loading && !summary ? (
            <LoadingState label="Loading insights" />
          ) : error ? (
            <div className="mt-8">
              <ErrorState message={error} onRetry={() => void load()} />
            </div>
          ) : summary ? (
            <InsightsContent value={summary} refreshing={loading} />
          ) : null}
        </div>
      </PageContainer>
    </main>
  );
}

function InsightsContent({
  value,
  refreshing,
}: {
  value: Insights;
  refreshing: boolean;
}) {
  if (!value.transactionCount)
    return (
      <div className="mt-8">
        <EmptyState
          title="No activity in this range"
          description="Try another date range or refresh after completing a transaction."
        />
      </div>
    );
  return (
    <div className="mt-8 space-y-6">
      {refreshing ? (
        <p className="text-sm font-semibold text-slate-600">
          Refreshing insights…
        </p>
      ) : null}
      <Card className="p-6">
        <p className="text-sm font-semibold text-slate-500">
          All transaction attempts
        </p>
        <p className="mt-2 text-3xl font-bold">
          {value.transactionCount.toLocaleString('en-IN')}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {new Date(value.range.from).toLocaleDateString()} –{' '}
          {new Date(value.range.to).toLocaleDateString()}
        </p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        {value.currencies.map((item) => (
          <Card key={item.currency} className="overflow-hidden p-6">
            <h2 className="text-xl font-bold">{item.currency}</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <Metric
                label="Incoming"
                value={formatMoney(item.incoming, item.currency)}
              />
              <Metric
                label="Outgoing"
                value={formatMoney(item.outgoing, item.currency)}
              />
              <Metric label="Successful" value={String(item.successfulCount)} />
              <Metric
                label="Failed/reversed"
                value={String(item.failedOrCancelledCount)}
              />
              <Metric
                label="Average successful amount"
                value={formatMoney(item.averageAmount, item.currency)}
              />
              <Metric
                label="Largest successful amount"
                value={formatMoney(item.largestAmount, item.currency)}
              />
            </dl>
            <h3 className="mt-6 font-bold">Daily trend</h3>
            {item.trend.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Incoming</th>
                      <th className="p-2">Outgoing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.trend.map((point) => (
                      <tr key={point.date} className="border-t">
                        <td className="p-2">{point.date}</td>
                        <td className="p-2 tabular-nums">
                          {formatMoney(point.incoming, item.currency)}
                        </td>
                        <td className="p-2 tabular-nums">
                          {formatMoney(point.outgoing, item.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                No successful activity to chart.
              </p>
            )}
          </Card>
        ))}
      </div>
      {value.categoriesAvailable ? <Card className="p-6"><h2 className="text-lg font-bold">Category totals</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{value.categoryTotals.map(item=><div key={item.category} className="rounded-xl bg-slate-50 p-4"><h3 className="font-bold">{item.category}</h3>{item.currencies.map(total=><p key={total.currency} className="mt-1 text-sm tabular-nums">{formatMoney(total.amount,total.currency)}</p>)}</div>)}</div></Card> : null}
      <Card className="p-6"><h2 className="text-lg font-bold">Activity breakdown</h2><div className="mt-4 flex flex-wrap gap-3">{value.typeBreakdown.map(item=><p key={item.type} className="rounded-xl bg-slate-50 p-3"><strong>{item.type}</strong>: {item.count}</p>)}</div></Card>
      <Card className="p-6">
        <h2 className="text-lg font-bold">Recent activity</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Type</th>
                <th className="p-3">Direction</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {value.recent.map((item) => (
                <tr key={`${item.type}:${item.id}`} className="border-t">
                  <td className="whitespace-nowrap p-3">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">{item.type}</td>
                  <td className="p-3">{item.direction}</td>
                  <td className="whitespace-nowrap p-3 font-semibold tabular-nums">
                    {formatMoney(item.amount, item.currency)}
                  </td>
                  <td className="p-3">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {!value.categoriesAvailable ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-semibold text-slate-700"
        >
          Category insights unavailable for this transaction data.
        </p>
      ) : null}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}
