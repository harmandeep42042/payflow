'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdminShell, ErrorState, MetricCard, PageHeader } from '../components/admin';
import { Button, RefreshIcon, Skeleton, TransactionsIcon } from '../components/ui';
import {
  activeTransactionFilterCount, buildTransactionsQuery, buildTransactionsUrlQuery,
  clearTransactionFilters, escapeCsvCell, formatTransactionAmount,
  formatTransactionDate, LatestTransactionRequest, normalizeTransactionPage,
  normalizeTransactions, parseTransactionFilters, TransactionSummary,
  TransactionsFilterBar, TransactionsPagination, TransactionsTable,
  transactionAmountsByCurrency, userName, type AdminTransaction,
  type TransactionFilters, type TransactionsResponse,
} from '../components/transactions';
import { AdminApiError, type AdminUser, adminAuthenticatedRequest, clearAdminSession, logoutAdmin, restoreAdminSession } from '../lib/api';

function message(error: unknown, fallback: string) { if (error instanceof AdminApiError) return `${error.status ? `HTTP ${error.status}: ` : ''}${error.message}`; return error instanceof Error ? error.message : fallback; }
function nonNegativeInteger(value: unknown) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0; }

function TransactionsPageContent() {
  const router = useRouter(); const searchParams = useSearchParams();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>(() => parseTransactionFilters(new URLSearchParams(searchParams.toString())));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [total, setTotal] = useState(0); const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false); const [hasPrevious, setHasPrevious] = useState(false);
  const [isLoading, setIsLoading] = useState(true); const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false); const hasLoadedRef = useRef(false);
  const [error, setError] = useState(''); const [announcement, setAnnouncement] = useState('');
  const latestRef = useRef(new LatestTransactionRequest());

  useEffect(() => { void restoreAdminSession().then(setAdmin).catch(() => { clearAdminSession(); router.replace('/login'); }); }, [router]);
  useEffect(() => { const next = parseTransactionFilters(new URLSearchParams(searchParams.toString())); setFilters((current) => buildTransactionsQuery(current) === buildTransactionsQuery(next) ? current : next); setSearchInput(next.search); }, [searchParams]);
  useEffect(() => () => latestRef.current.abort(), []);
  const loadTransactions = useCallback(async () => {
    if (!admin) return; const { controller, requestId } = latestRef.current.begin();
    hasLoadedRef.current ? setIsRefreshing(true) : setIsLoading(true); setError('');
    try {
      const response = await adminAuthenticatedRequest<TransactionsResponse>(`/admin/transactions?${buildTransactionsQuery(filters)}`, { signal: controller.signal });
      if (!latestRef.current.isLatest(requestId)) return;
      const items = normalizeTransactions(response?.transactions); const responseTotal = nonNegativeInteger(response?.pagination?.total); const pages = nonNegativeInteger(response?.pagination?.totalPages);
      const page = normalizeTransactionPage(filters.page, pages); if (page !== filters.page) { setFilters((current) => ({ ...current, page })); return; }
      setTransactions(items); setTotal(responseTotal); setTotalPages(pages); setHasNext(Boolean(response?.pagination?.hasNextPage)); setHasPrevious(Boolean(response?.pagination?.hasPreviousPage));
      hasLoadedRef.current = true; setHasLoaded(true); setAnnouncement(`${responseTotal} matching supported transactions loaded.`);
    } catch (requestError) { if (latestRef.current.isLatest(requestId)) setError(message(requestError, 'Unable to load transactions')); }
    finally { if (latestRef.current.isLatest(requestId)) { setIsLoading(false); setIsRefreshing(false); } }
  }, [admin, filters]);
  useEffect(() => { if (!admin) return; router.replace(`/transactions?${buildTransactionsUrlQuery(filters)}`, { scroll: false }); void loadTransactions(); }, [admin, filters, loadTransactions, router]);

  const activeCount = useMemo(() => activeTransactionFilterCount(filters), [filters]);
  const start = total ? (filters.page - 1) * filters.limit + 1 : 0; const end = Math.min(filters.page * filters.limit, total);
  function updateFilters(next: Partial<TransactionFilters>, resetPage = true) { setFilters((current) => ({ ...current, ...next, page: resetPage ? 1 : (next.page ?? current.page) })); }
  function clearFilters() { setSearchInput(''); setFilters((current) => clearTransactionFilters(current)); }
  function exportCsv() {
    if (!transactions.length) return;
    const headers = ['Transaction ID', 'Type', 'Amount', 'Currency', 'Status', 'User Name', 'User Email', 'Destination User', 'Wallet ID', 'Source Wallet ID', 'Destination Wallet ID', 'Reference', 'Description', 'Failure Reason', 'Created At', 'Completed At'];
    const rows = transactions.map((item) => [
      escapeCsvCell(item.id), escapeCsvCell(item.type), escapeCsvCell(item.amount), escapeCsvCell(item.currency), escapeCsvCell(item.status),
      escapeCsvCell(userName(item.user), true), escapeCsvCell(item.user.email, true), escapeCsvCell(item.destinationUser ? userName(item.destinationUser) : '', true),
      escapeCsvCell(item.walletId), escapeCsvCell(item.sourceWalletId), escapeCsvCell(item.destinationWalletId), escapeCsvCell(item.reference, true),
      escapeCsvCell(item.description, true), escapeCsvCell(item.failureReason, true), escapeCsvCell(item.createdAt), escapeCsvCell(item.completedAt),
    ].join(','));
    const content = [headers.map((header) => escapeCsvCell(header)).join(','), ...rows].join('\r\n'); const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `payflow-supported-transactions-current-page-${filters.page}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  function exportPdf() {
    if (!transactions.length) return; const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    document.setFontSize(18); document.text('Payflow Supported Transactions', 14, 17); document.setFontSize(9);
    document.text(`Scope: current page ${filters.page}; deposits, withdrawals and transfers only`, 14, 25);
    document.text(`Generated: ${formatTransactionDate(new Date().toISOString())}`, 14, 31);
    const totals = transactionAmountsByCurrency(transactions); let y = 37; document.text('Current-page amounts by currency (no conversion):', 14, y);
    for (const totalItem of totals) { y += 5; document.text(formatTransactionAmount(totalItem.amount, totalItem.currency), 18, y); }
    autoTable(document, { startY: y + 7, head: [['Type', 'Transaction ID', 'Participants', 'Amount', 'Status', 'Reference / description', 'Created']], body: transactions.map((item) => [item.type, item.id, item.type === 'TRANSFER' ? `${userName(item.user)} → ${item.destinationUser ? userName(item.destinationUser) : 'Unavailable'}` : userName(item.user), formatTransactionAmount(item.amount, item.currency), item.status, item.reference ?? item.description ?? item.failureReason ?? '—', formatTransactionDate(item.createdAt)]), styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' } });
    document.save(`payflow-supported-transactions-current-page-${filters.page}.pdf`);
  }
  async function handleLogout() { await logoutAdmin(); router.push('/login'); router.refresh(); }
  if (!admin) return <main aria-busy="true" className="min-h-screen bg-[#F6F8FA] p-6"><Skeleton className="mx-auto h-96 max-w-7xl" /></main>;
  return <AdminShell admin={admin} onLogout={() => void handleLogout()}>
    <PageHeader eyebrow="Transactions management" title="Transactions" description="Review supported deposits, withdrawals and transfers. Payments are outside this view." actions={<><Button variant="secondary" disabled={isLoading || !transactions.length} onClick={exportCsv}>Export CSV</Button><Button variant="secondary" disabled={isLoading || !transactions.length} onClick={exportPdf}>Export PDF</Button><Button disabled={isLoading || isRefreshing} onClick={() => void loadTransactions()}><RefreshIcon className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />{isRefreshing ? 'Refreshing…' : 'Refresh'}</Button></>} />
    <section aria-label="Transaction result summary" className="mt-6 grid gap-3 sm:grid-cols-3"><MetricCard label="Matching transactions" value={String(total)} description="Deposits, withdrawals and transfers" /><MetricCard label="Current result range" value={total ? `${start}–${end}` : '0'} description="Rows displayed from matching results" /><MetricCard label="Active filters" value={String(activeCount)} description="Search, type and status" /></section>
    <TransactionSummary transactions={transactions} />
    <TransactionsFilterBar searchInput={searchInput} type={filters.type} status={filters.status} limit={filters.limit} activeCount={activeCount} disabled={isLoading} onSearchInput={setSearchInput} onType={(type) => updateFilters({ type })} onStatus={(status) => updateFilters({ status })} onLimit={(limit) => updateFilters({ limit })} onSearch={() => updateFilters({ search: searchInput.trim() })} onClear={clearFilters} />
    {error ? <div className="mt-5"><ErrorState message={error} onRetry={() => void loadTransactions()} /></div> : null}
    <section aria-labelledby="transactions-list-title" className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-6"><span className="flex size-9 items-center justify-center rounded-md bg-slate-50 text-slate-600"><TransactionsIcon className="size-5" /></span><div><h2 id="transactions-list-title" className="text-base font-semibold text-slate-900">Supported transactions</h2><p className="text-sm text-slate-500">{isRefreshing ? 'Refreshing current results…' : `${total} matching deposits, withdrawals and transfers`}</p></div></div><TransactionsTable transactions={transactions} initialLoading={isLoading && !hasLoaded} filtered={activeCount > 0} onDetails={(id) => router.push(`/transactions/${id}`)} onClear={clearFilters} /><TransactionsPagination page={filters.page} totalPages={totalPages} total={total} start={start} end={end} hasPrevious={hasPrevious} hasNext={hasNext} disabled={isLoading || isRefreshing} onPage={(page) => updateFilters({ page }, false)} /></section>
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </AdminShell>;
}
export default function TransactionsPage() { return <Suspense fallback={<main aria-busy="true" className="min-h-screen bg-[#F6F8FA] p-6"><Skeleton className="h-96" /></main>}><TransactionsPageContent /></Suspense>; }
