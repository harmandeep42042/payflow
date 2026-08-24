'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AnalyticsCharts, AnalyticsDataTable, AnalyticsSummary, ANALYTICS_PERIODS,
  buildAnalyticsRequest, buildAnalyticsUrl, hasAnalyticsData,
  LatestAnalyticsRequest, normalizeAnalyticsResponse, parseAnalyticsPeriod,
  type AnalyticsData, type AnalyticsPeriod,
} from '../components/analytics';
import { AdminShell, ErrorState, PageHeader } from '../components/admin';
import { Button, Card, RefreshIcon, Skeleton } from '../components/ui';
import {
  AdminApiError, adminAuthenticatedRequest, clearAdminSession, logoutAdmin,
  restoreAdminSession, type AdminUser,
} from '../lib/api';

function safeErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    return error.status ? `HTTP ${error.status}: Unable to load analytics.` : 'Unable to connect to Payflow.';
  }
  return 'Unable to load analytics. Please try again.';
}

function AnalyticsSkeleton() {
  return (
    <main aria-busy="true" aria-label="Loading analytics" className="min-h-screen bg-[#F6F8FA] p-4 sm:p-6">
      <div className="mx-auto max-w-[100rem] space-y-6">
        <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      </div>
    </main>
  );
}

function EmptyAnalytics({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No analytics data</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">No supported transaction, user, or wallet activity was returned for this rolling period.</p>
      <Button className="mt-5" variant="secondary" onClick={onRetry}>Refresh data</Button>
    </Card>
  );
}

function AnalyticsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>(() => parseAnalyticsPeriod(searchParams.get('days')));
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
  const latestRequestRef = useRef(new LatestAnalyticsRequest());

  useEffect(() => {
    void restoreAdminSession().then(setAdmin).catch(() => {
      clearAdminSession();
      router.replace('/login');
    });
  }, [router]);

  useEffect(() => {
    const normalized = parseAnalyticsPeriod(searchParams.get('days'));
    setPeriod(normalized);
    if (searchParams.get('days') !== String(normalized)) {
      router.replace(buildAnalyticsUrl(normalized), { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => () => latestRequestRef.current.abort(), []);

  const loadAnalytics = useCallback(async () => {
    if (!admin) return;
    const { controller, requestId } = latestRequestRef.current.begin();
    hasLoadedRef.current ? setIsRefreshing(true) : setIsLoading(true);
    setError('');
    try {
      const response = await adminAuthenticatedRequest<unknown>(buildAnalyticsRequest(period), { signal: controller.signal });
      if (!latestRequestRef.current.isLatest(requestId)) return;
      setAnalytics(normalizeAnalyticsResponse(response));
      setLastUpdated(new Date());
      hasLoadedRef.current = true;
    } catch (requestError) {
      if (!latestRequestRef.current.isLatest(requestId)) return;
      setError(safeErrorMessage(requestError));
    } finally {
      if (latestRequestRef.current.isLatest(requestId)) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [admin, period]);

  useEffect(() => { if (admin) void loadAnalytics(); }, [admin, loadAnalytics]);
  useEffect(() => {
    if (!admin || !autoRefresh) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadAnalytics();
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [admin, autoRefresh, loadAnalytics]);

  function selectPeriod(next: AnalyticsPeriod): void {
    if (next !== period) router.push(buildAnalyticsUrl(next), { scroll: false });
  }
  async function handleLogout(): Promise<void> {
    await logoutAdmin();
    router.push('/login');
    router.refresh();
  }
  if (!admin) return <AnalyticsSkeleton />;

  const initialLoading = isLoading && !analytics;
  return (
    <AdminShell admin={admin} onLogout={() => void handleLogout()}>
      <div aria-busy={initialLoading || isRefreshing} className="space-y-6">
        <PageHeader
          eyebrow="Operations intelligence"
          title="Analytics"
          description="Operational analytics for deposits, withdrawals and transfers."
          actions={<>
            <Button variant="secondary" aria-pressed={!autoRefresh} onClick={() => setAutoRefresh((current) => !current)}>
              {autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
            </Button>
            <Button disabled={isRefreshing || initialLoading} onClick={() => void loadAnalytics()}>
              <RefreshIcon className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </>}
        />

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Rolling period</p>
            <p className="mt-0.5 text-xs text-slate-500">Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString('en-IN') : 'Not yet updated'}</p>
          </div>
          <div role="group" aria-label="Analytics period" className="grid grid-cols-3 gap-2 sm:flex">
            {ANALYTICS_PERIODS.map((days) => (
              <Button key={days} size="sm" variant={period === days ? 'primary' : 'secondary'} aria-pressed={period === days} onClick={() => selectPeriod(days)}>
                {days} days
              </Button>
            ))}
          </div>
        </div>

        <div aria-live="polite">{error ? <ErrorState message={error} onRetry={() => void loadAnalytics()} /> : null}</div>

        {initialLoading ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36" />)}
            </div>
            <div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
          </div>
        ) : analytics && hasAnalyticsData(analytics) ? (
          <>
            <AnalyticsSummary summary={analytics.summary} />
            <Card className="p-4 text-sm text-slate-600 sm:p-5">
              <p><span className="font-medium text-slate-900">Success rate:</span> Completed transactions / all transactions.</p>
              <p className="mt-1">Analytics covers deposits, withdrawals and transfers for the selected rolling period.</p>
              <p className="mt-1">Payment transactions are not included in the current Analytics API.</p>
            </Card>
            <AnalyticsCharts data={analytics} />
            <AnalyticsDataTable data={analytics} />
          </>
        ) : <EmptyAnalytics onRetry={() => void loadAnalytics()} />}
      </div>
    </AdminShell>
  );
}

export default function AnalyticsPage() {
  return <Suspense fallback={<AnalyticsSkeleton />}><AnalyticsPageContent /></Suspense>;
}
