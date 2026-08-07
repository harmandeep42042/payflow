'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  adminAuthenticatedRequest,
  clearAdminSession,
  getStoredAdmin,
  hasValidAdminSession,
} from '../lib/api';

type AuditLogItem = {
  id: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  description?: string | null;
  metadata?: Record<
    string,
    unknown
  > | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

type AuditLogsResponse = {
  auditLogs: AuditLogItem[];

  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  filters: {
    action: string;
    targetType: string;
    actorUserId: string;
  };
};

function escapeCsvValue(
  value: unknown,
): string {
  const text =
    value === null ||
    value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

  return `"${text.replace(
    /"/g,
    '""',
  )}"`;
}

function downloadCsv(
  filename: string,
  content: string,
): void {
  const csvWithBom =
    `\uFEFF${content}`;

  const blob =
    new Blob(
      [csvWithBom],
      {
        type:
          'text/csv;charset=utf-8;',
      },
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function getActionClasses(
  action: string,
): string {
  if (
    action.includes('BLOCK')
  ) {
    return 'bg-red-100 text-red-700';
  }

  if (
    action.includes('SUSPEND')
  ) {
    return 'bg-amber-100 text-amber-700';
  }

  if (
    action.includes('ACTIVATE')
  ) {
    return 'bg-emerald-100 text-emerald-700';
  }

  return 'bg-sky-100 text-sky-700';
}

export default function AuditLogsPage() {
  const router =
    useRouter();

  const [auditLogs, setAuditLogs] =
    useState<AuditLogItem[]>([]);

  const [actionInput, setActionInput] =
    useState('');

  const [action, setAction] =
    useState('');

  const [
    targetType,
    setTargetType,
  ] = useState('ALL');

  const [
    actorUserIdInput,
    setActorUserIdInput,
  ] = useState('');

  const [
    actorUserId,
    setActorUserId,
  ] = useState('');

  const [page, setPage] =
    useState(1);

  const [limit] =
    useState(20);

  const [total, setTotal] =
    useState(0);

  const [
    totalPages,
    setTotalPages,
  ] = useState(0);

  const [
    hasNextPage,
    setHasNextPage,
  ] = useState(false);

  const [
    hasPreviousPage,
    setHasPreviousPage,
  ] = useState(false);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [error, setError] =
    useState('');

  const [
    isExporting,
    setIsExporting,
  ] = useState(false);

  const loadAuditLogs =
    useCallback(
      async (): Promise<void> => {
        try {
          setIsLoading(true);
          setError('');

          const query =
            new URLSearchParams({
              page:
                String(page),

              limit:
                String(limit),
            });

          if (action) {
            query.set(
              'action',
              action,
            );
          }

          if (
            targetType !== 'ALL'
          ) {
            query.set(
              'targetType',
              targetType,
            );
          }

          if (actorUserId) {
            query.set(
              'actorUserId',
              actorUserId,
            );
          }

          const response =
            await adminAuthenticatedRequest<AuditLogsResponse>(
              `/admin/audit-logs?${query.toString()}`,
            );

          setAuditLogs(
            response.auditLogs,
          );

          setTotal(
            response.pagination.total,
          );

          setTotalPages(
            response.pagination.totalPages,
          );

          setHasNextPage(
            response.pagination
              .hasNextPage,
          );

          setHasPreviousPage(
            response.pagination
              .hasPreviousPage,
          );
        } catch (requestError) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : 'Unable to load audit logs';

          if (
            message
              .toLowerCase()
              .includes('session') ||
            message
              .toLowerCase()
              .includes('unauthorized')
          ) {
            clearAdminSession();
            router.replace('/login');
            return;
          }

          setError(message);
        } finally {
          setIsLoading(false);
        }
      },
      [
        action,
        actorUserId,
        limit,
        page,
        router,
        targetType,
      ],
    );

  useEffect(() => {
    if (!hasValidAdminSession()) {
      router.replace('/login');
      return;
    }

    const admin =
      getStoredAdmin();

    if (!admin) {
      clearAdminSession();
      router.replace('/login');
      return;
    }

    void loadAuditLogs();
  }, [
    loadAuditLogs,
    router,
  ]);

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    setPage(1);

    setAction(
      actionInput.trim(),
    );

    setActorUserId(
      actorUserIdInput.trim(),
    );
  }

  function clearFilters(): void {
    setActionInput('');
    setAction('');

    setTargetType('ALL');

    setActorUserIdInput('');
    setActorUserId('');

    setPage(1);
  }

  async function exportAuditLogs():
    Promise<void> {
    try {
      setIsExporting(true);
      setError('');

      const exportedLogs:
        AuditLogItem[] = [];

      let exportPage = 1;
      let exportTotalPages = 1;

      do {
        const query =
          new URLSearchParams({
            page:
              String(exportPage),

            limit:
              '100',
          });

        if (action) {
          query.set(
            'action',
            action,
          );
        }

        if (
          targetType !== 'ALL'
        ) {
          query.set(
            'targetType',
            targetType,
          );
        }

        if (actorUserId) {
          query.set(
            'actorUserId',
            actorUserId,
          );
        }

        const response =
          await adminAuthenticatedRequest<AuditLogsResponse>(
            `/admin/audit-logs?${query.toString()}`,
          );

        exportedLogs.push(
          ...response.auditLogs,
        );

        exportTotalPages =
          response.pagination.totalPages;

        exportPage += 1;
      } while (
        exportPage <=
        exportTotalPages
      );

      if (
        exportedLogs.length === 0
      ) {
        setError(
          'There are no audit logs to export',
        );
        return;
      }

      const headers = [
        'Audit Log ID',
        'Action',
        'Actor User ID',
        'Actor Email',
        'Target Type',
        'Target ID',
        'Description',
        'Metadata',
        'IP Address',
        'User Agent',
        'Created At',
      ];

      const rows =
        exportedLogs.map(
          (log) => [
            log.id,
            log.action,
            log.actorUserId ?? '',
            log.actorEmail ?? 'System',
            log.targetType,
            log.targetId ?? '',
            log.description ?? '',
            log.metadata ?? '',
            log.ipAddress ?? '',
            log.userAgent ?? '',
            new Date(
              log.createdAt,
            ).toISOString(),
          ],
        );

      const csvContent = [
        headers
          .map(escapeCsvValue)
          .join(','),

        ...rows.map(
          (row) =>
            row
              .map(escapeCsvValue)
              .join(','),
        ),
      ].join('\r\n');

      const date =
        new Date()
          .toISOString()
          .slice(0, 10);

      downloadCsv(
        `payflow-audit-logs-${date}.csv`,
        csvContent,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to export audit logs',
      );
    } finally {
      setIsExporting(false);
    }
  }

  function handleLogout(): void {
    clearAdminSession();

    router.replace('/login');
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-sky-600">
              Payflow Admin
            </h1>

            <p className="text-sm text-slate-500">
              Audit Logs
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  '/dashboard',
                )
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
            Security & Compliance
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Administration audit logs
          </h2>

          <p className="mt-2 text-slate-600">
            Review important administration actions.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form
            onSubmit={handleSearch}
            className="grid gap-4 lg:grid-cols-[1fr_180px_1fr_auto_auto]"
          >
            <input
              type="text"
              value={actionInput}
              onChange={(event) =>
                setActionInput(
                  event.target.value,
                )
              }
              placeholder="Action e.g. BLOCK_USER"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />

            <select
              value={targetType}
              onChange={(event) => {
                setTargetType(
                  event.target.value,
                );

                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="ALL">
                All targets
              </option>

              <option value="USER">
                User
              </option>

              <option value="WALLET">
                Wallet
              </option>

              <option value="TRANSACTION">
                Transaction
              </option>
            </select>

            <input
              type="text"
              value={actorUserIdInput}
              onChange={(event) =>
                setActorUserIdInput(
                  event.target.value,
                )
              }
              placeholder="Actor user ID"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />

            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white"
            >
              Search
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700"
            >
              Clear
            </button>
          </form>
        </section>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                Activity history
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Total logs: {total}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isExporting}
                onClick={() =>
                  void exportAuditLogs()
                }
                className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting
                  ? 'Exporting...'
                  : 'Export CSV'}
              </button>

              <button
                type="button"
                onClick={() =>
                  void loadAuditLogs()
                }
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white"
              >
                Refresh
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center font-semibold text-slate-500">
              Loading audit logs...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No audit logs found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">
                      Action
                    </th>

                    <th className="px-6 py-4">
                      Actor
                    </th>

                    <th className="px-6 py-4">
                      Target
                    </th>

                    <th className="px-6 py-4">
                      Description
                    </th>

                    <th className="px-6 py-4">
                      Metadata
                    </th>

                    <th className="px-6 py-4">
                      Date & Time
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map(
                    (log) => (
                      <tr
                        key={log.id}
                        className="align-top transition hover:bg-slate-50"
                      >
                        <td className="px-6 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${getActionClasses(
                              log.action,
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <p className="text-sm font-semibold text-slate-900">
                            {log.actorEmail ??
                              'System'}
                          </p>

                          <p className="mt-1 break-all text-xs text-slate-400">
                            {log.actorUserId ??
                              'No actor ID'}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-slate-700">
                            {log.targetType}
                          </p>

                          <p className="mt-1 break-all text-xs text-slate-400">
                            {log.targetId ??
                              'No target ID'}
                          </p>
                        </td>

                        <td className="max-w-xs px-6 py-5 text-sm text-slate-700">
                          {log.description ??
                            'No description'}
                        </td>

                        <td className="max-w-sm px-6 py-5">
                          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-slate-100 p-3 text-xs text-slate-700">
                            {log.metadata
                              ? JSON.stringify(
                                  log.metadata,
                                  null,
                                  2,
                                )
                              : 'No metadata'}
                          </pre>
                        </td>

                        <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-500">
                          {new Date(
                            log.createdAt,
                          ).toLocaleString(
                            'en-IN',
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 px-6 py-5 sm:flex-row">
            <p className="text-sm text-slate-500">
              Page {page} of{' '}
              {totalPages || 1}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={
                  !hasPreviousPage ||
                  isLoading
                }
                onClick={() =>
                  setPage((current) =>
                    Math.max(
                      current - 1,
                      1,
                    ),
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                disabled={
                  !hasNextPage ||
                  isLoading
                }
                onClick={() =>
                  setPage(
                    (current) =>
                      current + 1,
                  )
                }
                className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}