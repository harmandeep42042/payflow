'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminShell, ErrorState, MetricCard, PageHeader } from '../components/admin';
import { Button, Card, RefreshIcon, Skeleton, WalletIcon } from '../components/ui';
import {
  acquireWalletMutationLock, activeWalletFilterCount, buildWalletsQuery,
  buildWalletsUrlQuery, clearWalletFilters, formatWalletBalance,
  groupWalletBalances, LatestWalletRequest, normalizeWallet, normalizeWalletPage,
  normalizeWallets, parseWalletFilters, WalletDetailsDialog,
  WalletStatusConfirmDialog, WalletsFilterBar, WalletsPagination, WalletsTable,
  walletStatusCounts, type AdminWallet, type WalletFilters, type WalletsResponse,
  type WalletStatus,
} from '../components/wallets';
import {
  AdminApiError, type AdminUser, adminAuthenticatedRequest, clearAdminSession,
  logoutAdmin, restoreAdminSession,
} from '../lib/api';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AdminApiError)
    return `${error.status ? `HTTP ${error.status}: ` : ''}${error.message}`;
  return error instanceof Error ? error.message : fallback;
}
function safeNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function WalletsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [filters, setFilters] = useState<WalletFilters>(() =>
    parseWalletFilters(new URLSearchParams(searchParams.toString())),
  );
  const [searchInput, setSearchInput] = useState(filters.search);
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [knownCurrencies, setKnownCurrencies] = useState<string[]>(() =>
    filters.currency === 'ALL' ? [] : [filters.currency],
  );
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [success, setSuccess] = useState('');
  const hasLoadedRef = useRef(false);
  const latestRequestRef = useRef(new LatestWalletRequest());
  const mutationLockRef = useRef(false);
  const [selectedWallet, setSelectedWallet] = useState<AdminWallet | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTrigger, setDetailsTrigger] = useState<HTMLButtonElement | null>(null);
  const [pendingStatus, setPendingStatus] = useState<WalletStatus | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    void restoreAdminSession().then(setAdmin).catch(() => {
      clearAdminSession();
      router.replace('/login');
    });
  }, [router]);
  useEffect(() => {
    const next = parseWalletFilters(new URLSearchParams(searchParams.toString()));
    setFilters((current) =>
      buildWalletsQuery(current) === buildWalletsQuery(next) ? current : next,
    );
    setSearchInput(next.search);
    if (next.currency !== 'ALL')
      setKnownCurrencies((current) =>
        Array.from(new Set([...current, next.currency])).sort(),
      );
  }, [searchParams]);
  useEffect(() => () => latestRequestRef.current.abort(), []);

  const loadWallets = useCallback(async () => {
    if (!admin) return;
    const { controller, requestId } = latestRequestRef.current.begin();
    hasLoadedRef.current ? setIsRefreshing(true) : setIsLoading(true);
    setError('');
    try {
      const response = await adminAuthenticatedRequest<WalletsResponse>(
        `/admin/wallets?${buildWalletsQuery(filters)}`,
        { signal: controller.signal },
      );
      if (!latestRequestRef.current.isLatest(requestId)) return;
      const nextWallets = normalizeWallets(response?.wallets);
      const nextTotal = safeNumber(response?.pagination?.total);
      const nextTotalPages = safeNumber(response?.pagination?.totalPages);
      const normalizedPage = normalizeWalletPage(filters.page, nextTotalPages);
      if (normalizedPage !== filters.page) {
        setFilters((current) => ({ ...current, page: normalizedPage }));
        return;
      }
      setWallets(nextWallets);
      setKnownCurrencies((current) =>
        Array.from(new Set([
          ...current,
          ...nextWallets.map((wallet) => wallet.currency).filter((code) => code !== 'UNKNOWN'),
          ...(filters.currency === 'ALL' ? [] : [filters.currency]),
        ])).sort(),
      );
      setTotal(nextTotal);
      setTotalPages(nextTotalPages);
      setHasNext(Boolean(response?.pagination?.hasNextPage));
      setHasPrevious(Boolean(response?.pagination?.hasPreviousPage));
      hasLoadedRef.current = true;
      setHasLoaded(true);
      setAnnouncement(`${nextTotal} matching wallets loaded.`);
    } catch (requestError) {
      if (!latestRequestRef.current.isLatest(requestId)) return;
      setError(errorMessage(requestError, 'Unable to load wallets'));
    } finally {
      if (latestRequestRef.current.isLatest(requestId)) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [admin, filters]);

  useEffect(() => {
    if (!admin) return;
    router.replace(`/wallets?${buildWalletsUrlQuery(filters)}`, { scroll: false });
    void loadWallets();
  }, [admin, filters, loadWallets, router]);

  const filterCount = useMemo(() => activeWalletFilterCount(filters), [filters]);
  const balances = useMemo(() => groupWalletBalances(wallets), [wallets]);
  const statusCounts = useMemo(() => walletStatusCounts(wallets), [wallets]);
  const start = total ? (filters.page - 1) * filters.limit + 1 : 0;
  const end = Math.min(filters.page * filters.limit, total);
  function updateFilters(next: Partial<WalletFilters>, resetPage = true) {
    setFilters((current) => ({
      ...current, ...next,
      page: resetPage ? 1 : (next.page ?? current.page),
    }));
  }
  function clearFilters() {
    setSearchInput('');
    setFilters((current) => clearWalletFilters(current));
  }
  const openDetails = useCallback((wallet: AdminWallet, trigger: HTMLButtonElement) => {
    setSuccess('');
    setDetailsTrigger(trigger);
    setSelectedWallet(wallet);
    setDetailsOpen(true);
  }, []);
  const closeDetails = useCallback(() => {
    if (mutationLockRef.current) return;
    setDetailsOpen(false);
    setPendingStatus(null);
    setStatusError('');
  }, []);
  const requestStatus = useCallback((status: WalletStatus) => {
    setStatusError('');
    setPendingStatus(status);
  }, []);
  const cancelStatus = useCallback(() => {
    if (mutationLockRef.current) return;
    setPendingStatus(null);
    setStatusError('');
  }, []);
  async function updateStatus() {
    if (!selectedWallet || !pendingStatus || selectedWallet.status === 'CLOSED' ||
      !acquireWalletMutationLock(mutationLockRef)) return;
    setIsUpdating(true);
    setStatusError('');
    setSuccess('');
    try {
      const response = await adminAuthenticatedRequest<{ message?: unknown; wallet?: unknown }>(
        `/admin/wallets/${selectedWallet.id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: pendingStatus }) },
      );
      const updated = normalizeWallet(response?.wallet);
      if (!updated || updated.status !== pendingStatus)
        throw new Error('Wallet status response was incomplete');
      const message = typeof response.message === 'string'
        ? response.message : `Wallet status changed to ${updated.status}`;
      setPendingStatus(null);
      setDetailsOpen(false);
      setSuccess(message);
      setAnnouncement(message);
      await loadWallets();
    } catch (requestError) {
      setStatusError(errorMessage(requestError, 'Unable to update wallet status'));
    } finally {
      mutationLockRef.current = false;
      setIsUpdating(false);
    }
  }
  async function handleLogout() {
    await logoutAdmin();
    router.push('/login');
    router.refresh();
  }
  if (!admin)
    return <main aria-busy="true" className="min-h-screen bg-[#F6F8FA] p-6"><div className="mx-auto max-w-7xl"><Skeleton className="h-8 w-48" /><Skeleton className="mt-6 h-32" /><Skeleton className="mt-5 h-96" /></div></main>;

  return (
    <AdminShell admin={admin} onLogout={() => void handleLogout()}>
      <PageHeader eyebrow="Wallet management" title="Wallets" description="Review balances, account activity and wallet controls without combining currencies." actions={<Button disabled={isLoading || isRefreshing} onClick={() => void loadWallets()}><RefreshIcon className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />{isRefreshing ? 'Refreshing…' : 'Refresh'}</Button>} />
      <section aria-label="Wallet result summary" className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Matching wallets" value={String(total)} description="Across the current filters" />
        <MetricCard label="Current result range" value={total ? `${start}–${end}` : '0'} description="Rows displayed from matching results" />
        <MetricCard label="Active filters" value={String(filterCount)} description="Search, status and currency" />
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current-page status breakdown</p><div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span><strong className="tabular-nums text-slate-950">{statusCounts.ACTIVE}</strong> <span className="text-slate-500">Active</span></span><span><strong className="tabular-nums text-slate-950">{statusCounts.FROZEN}</strong> <span className="text-slate-500">Frozen</span></span><span><strong className="tabular-nums text-slate-950">{statusCounts.CLOSED}</strong> <span className="text-slate-500">Closed</span></span></div></Card>
        <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current-page balances by currency</p><div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-950 tabular-nums">{balances.length ? balances.map((item) => <span key={item.currency}>{formatWalletBalance(item.balance, item.currency)}</span>) : <span className="font-normal text-slate-500">No balances on this page</span>}</div><p className="mt-2 text-xs text-slate-500">No currency conversion is performed.</p></Card>
      </section>
      <WalletsFilterBar searchInput={searchInput} status={filters.status} currency={filters.currency} currencies={knownCurrencies} limit={filters.limit} activeCount={filterCount} disabled={isLoading} onSearchInput={setSearchInput} onStatus={(status) => updateFilters({ status })} onCurrency={(currency) => updateFilters({ currency })} onLimit={(limit) => updateFilters({ limit })} onSearch={() => updateFilters({ search: searchInput.trim() })} onClear={clearFilters} />
      {error ? <div className="mt-5"><ErrorState message={error} onRetry={() => void loadWallets()} /></div> : null}
      {success ? <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div> : null}
      <section aria-labelledby="wallet-list-title" className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-md bg-slate-50 text-slate-600"><WalletIcon className="size-5" /></span><div><h2 id="wallet-list-title" className="text-base font-semibold text-slate-900">Wallets list</h2><p className="text-sm text-slate-500">{isRefreshing ? 'Refreshing current results…' : `${total} matching wallets`}</p></div></div></div>
        <WalletsTable wallets={wallets} initialLoading={isLoading && !hasLoaded} filtered={filterCount > 0} onDetails={openDetails} onClear={clearFilters} />
        <WalletsPagination page={filters.page} totalPages={totalPages} total={total} start={start} end={end} hasPrevious={hasPrevious} hasNext={hasNext} disabled={isLoading || isRefreshing} onPage={(page) => updateFilters({ page }, false)} />
      </section>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <WalletDetailsDialog open={detailsOpen} wallet={selectedWallet} onClose={closeDetails} onStatus={requestStatus} returnFocus={detailsTrigger} />
      <WalletStatusConfirmDialog wallet={selectedWallet} status={pendingStatus} open={Boolean(pendingStatus)} isUpdating={isUpdating} error={statusError} onCancel={cancelStatus} onConfirm={() => void updateStatus()} />
    </AdminShell>
  );
}

export default function WalletsPage() {
  return <Suspense fallback={<main aria-busy="true" className="min-h-screen bg-[#F6F8FA] p-6"><Skeleton className="h-96" /></main>}><WalletsPageContent /></Suspense>;
}
