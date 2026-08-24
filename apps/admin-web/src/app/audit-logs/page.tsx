'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  activeAuditFilterCount, AUDIT_EXPORT_LIMIT, auditLogsToCsv, auditPagination,
  AuditLogDetailsDialog, AuditLogFilterBar, AuditLogsPagination, AuditLogsTable,
  buildAuditApiQuery, buildAuditUrlQuery, clearAuditFilters, LatestAuditRequest,
  normalizeAuditLogs, normalizeAuditPage, parseAuditFilters,
  type AuditLogFilters, type AuditLogItem, type AuditLogsResponse,
} from '../components/audit-logs';
import { AdminShell, ErrorState, PageHeader } from '../components/admin';
import { Button, Card, RefreshIcon, Skeleton } from '../components/ui';
import {
  AdminApiError, adminAuthenticatedRequest, clearAdminSession, logoutAdmin,
  restoreAdminSession, type AdminUser,
} from '../lib/api';

function safeError(error: unknown, fallback: string): string {
  if (error instanceof AdminApiError) return error.status ? `HTTP ${error.status}: ${fallback}` : 'Unable to connect to Payflow.';
  return fallback;
}
function AuditPageSkeleton() {
  return <main aria-busy="true" aria-label="Loading audit logs" className="min-h-screen bg-[#F6F8FA] p-4 sm:p-6"><div className="mx-auto max-w-[100rem] space-y-6"><div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-80 max-w-full" /></div><Skeleton className="h-40" /><Skeleton className="h-96" /></div></main>;
}
function downloadCsv(content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payflow-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function AuditLogsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>(() => parseAuditFilters(new URLSearchParams(searchParams.toString())));
  const [actionInput, setActionInput] = useState(filters.action);
  const [actorInput, setActorInput] = useState(filters.actorUserId);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTrigger, setDetailsTrigger] = useState<HTMLButtonElement | null>(null);
  const hasLoadedRef = useRef(false);
  const latestRequestRef = useRef(new LatestAuditRequest());
  const exportControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void restoreAdminSession().then(setAdmin).catch(() => { clearAdminSession(); router.replace('/login'); });
  }, [router]);
  useEffect(() => {
    const next = parseAuditFilters(new URLSearchParams(searchParams.toString()));
    setFilters((current) => buildAuditUrlQuery(current) === buildAuditUrlQuery(next) ? current : next);
    setActionInput(next.action); setActorInput(next.actorUserId);
  }, [searchParams]);
  useEffect(() => () => { latestRequestRef.current.abort(); exportControllerRef.current?.abort(); }, []);

  const loadLogs = useCallback(async () => {
    if (!admin) return;
    const { controller, requestId } = latestRequestRef.current.begin();
    hasLoadedRef.current ? setIsRefreshing(true) : setIsLoading(true);
    setError('');
    try {
      const response = await adminAuthenticatedRequest<AuditLogsResponse>(`/admin/audit-logs?${buildAuditApiQuery(filters)}`, { signal: controller.signal });
      if (!latestRequestRef.current.isLatest(requestId)) return;
      const pagination = auditPagination(response?.pagination);
      const normalizedPage = normalizeAuditPage(filters.page, pagination.totalPages);
      if (normalizedPage !== filters.page) { setFilters((current) => ({ ...current, page: normalizedPage })); return; }
      setLogs(normalizeAuditLogs(response?.auditLogs));
      setTotal(pagination.total); setTotalPages(pagination.totalPages);
      setHasNext(pagination.hasNextPage); setHasPrevious(pagination.hasPreviousPage);
      hasLoadedRef.current = true;
    } catch (requestError) {
      if (!latestRequestRef.current.isLatest(requestId)) return;
      setError(safeError(requestError, 'Unable to load audit logs.'));
    } finally {
      if (latestRequestRef.current.isLatest(requestId)) { setIsLoading(false); setIsRefreshing(false); }
    }
  }, [admin, filters]);

  useEffect(() => {
    if (!admin) return;
    router.replace(`/audit-logs?${buildAuditUrlQuery(filters)}`, { scroll: false });
    void loadLogs();
  }, [admin, filters, loadLogs, router]);

  function applyFilters() { setFilters((current) => ({ ...current, action: actionInput.trim(), actorUserId: actorInput.trim(), page: 1 })); }
  function updateFilter(next: Partial<AuditLogFilters>) { setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 })); }
  function clearFilters() { setActionInput(''); setActorInput(''); setFilters((current) => clearAuditFilters(current)); }
  function openDetails(log: AuditLogItem, trigger: HTMLButtonElement) { setSelectedLog(log); setDetailsTrigger(trigger); setDetailsOpen(true); }
  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  async function exportLogs(): Promise<void> {
    if (isExporting) return;
    const controller = new AbortController(); exportControllerRef.current = controller;
    setIsExporting(true); setExportMessage(''); setExportProgress('Starting export…');
    try {
      const exported: AuditLogItem[] = [];
      let page = 1; let pages = 1; let available = 0;
      while (page <= pages && exported.length < AUDIT_EXPORT_LIMIT) {
        setExportProgress(`Exporting page ${page}…`);
        const response = await adminAuthenticatedRequest<AuditLogsResponse>(`/admin/audit-logs?${buildAuditApiQuery(filters, 100, page)}`, { signal: controller.signal });
        const pagination = auditPagination(response?.pagination); available = pagination.total;
        pages = Math.min(pagination.totalPages, Math.ceil(AUDIT_EXPORT_LIMIT / 100));
        exported.push(...normalizeAuditLogs(response?.auditLogs).slice(0, AUDIT_EXPORT_LIMIT - exported.length));
        page += 1;
      }
      if (controller.signal.aborted) return;
      if (!exported.length) { setExportMessage('There are no audit logs to export.'); return; }
      downloadCsv(auditLogsToCsv(exported));
      setExportMessage(available > AUDIT_EXPORT_LIMIT ? 'Export limited to the first 1000 records.' : `${exported.length} audit logs exported.`);
    } catch (requestError) {
      if (!controller.signal.aborted) setExportMessage(safeError(requestError, 'Unable to export audit logs.'));
    } finally {
      if (exportControllerRef.current === controller) exportControllerRef.current = null;
      setIsExporting(false); setExportProgress('');
    }
  }
  function cancelExport() { exportControllerRef.current?.abort(); setExportMessage('Export cancelled.'); }
  async function handleLogout() { exportControllerRef.current?.abort(); await logoutAdmin(); router.replace('/login'); router.refresh(); }

  const activeCount = useMemo(() => activeAuditFilterCount(filters), [filters]);
  const start = total ? (filters.page - 1) * filters.limit + 1 : 0;
  const end = Math.min(filters.page * filters.limit, total);
  if (!admin) return <AuditPageSkeleton />;
  const initialLoading = isLoading && !hasLoadedRef.current;
  return (
    <AdminShell admin={admin} onLogout={() => void handleLogout()}>
      <div className="space-y-6" aria-busy={initialLoading || isRefreshing}>
        <PageHeader eyebrow="Security & compliance" title="Audit Logs" description="Review administrative actions, actors, affected resources, and safely redacted event context." actions={<><Button variant="secondary" disabled={isExporting || initialLoading} onClick={() => void exportLogs()}>{isExporting ? exportProgress || 'Exporting…' : 'Export CSV'}</Button>{isExporting ? <Button variant="ghost" onClick={cancelExport}>Cancel export</Button> : null}<Button disabled={isRefreshing || initialLoading} onClick={() => void loadLogs()}><RefreshIcon className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />{isRefreshing ? 'Refreshing…' : 'Refresh'}</Button></>} />
        <AuditLogFilterBar actionInput={actionInput} targetType={filters.targetType} actorInput={actorInput} limit={filters.limit} activeCount={activeCount} disabled={initialLoading} onActionInput={setActionInput} onTargetType={(targetType) => updateFilter({ targetType })} onActorInput={setActorInput} onLimit={(limit) => updateFilter({ limit })} onApply={applyFilters} onClear={clearFilters} />
        <div aria-live="polite" className="space-y-3">{error ? <ErrorState message={error} onRetry={() => void loadLogs()} /> : null}{exportMessage ? <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{exportMessage}</p> : null}</div>
        <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-slate-900">Activity history</h2><p className="mt-1 text-sm text-slate-500">{total.toLocaleString('en-IN')} recorded events · Times include the displayed timezone</p></div>{isRefreshing ? <span className="text-xs text-slate-500" aria-live="polite">Refreshing records…</span> : null}</div><AuditLogsTable logs={logs} initialLoading={initialLoading} filtered={activeCount > 0} onDetails={openDetails} onClear={clearFilters} /><AuditLogsPagination page={filters.page} totalPages={totalPages} total={total} start={start} end={end} hasPrevious={hasPrevious} hasNext={hasNext} disabled={initialLoading || isRefreshing} onPage={(page) => updateFilter({ page })} /></Card>
      </div>
      <AuditLogDetailsDialog open={detailsOpen} log={selectedLog} onClose={closeDetails} returnFocus={detailsTrigger} />
    </AdminShell>
  );
}

export default function AuditLogsPage() { return <Suspense fallback={<AuditPageSkeleton />}><AuditLogsPageContent /></Suspense>; }
