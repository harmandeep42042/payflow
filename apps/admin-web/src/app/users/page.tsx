'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminShell, ErrorState, PageHeader } from '../components/admin';
import {
  Button,
  Card,
  RefreshIcon,
  Skeleton,
  UsersIcon,
} from '../components/ui';
import {
  activeUsersFilterCount,
  buildUsersQuery,
  buildUsersUrlQuery,
  clearUsersFilters,
  normalizeUsersPage,
  parseUsersFilters,
  acquireMutationLock,
  LatestUsersRequest,
  UserDetailsDialog,
  UsersFilterBar,
  UsersPagination,
  UsersTable,
  UserStatusConfirmDialog,
  type AdminUserDetails,
  type AdminUserItem,
  type UserStatus,
  type UsersFilters,
  type UsersResponse,
} from '../components/users';
import {
  AdminApiError,
  type AdminUser,
  adminAuthenticatedRequest,
  clearAdminSession,
  logoutAdmin,
  restoreAdminSession,
} from '../lib/api';

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AdminApiError)
    return `${error.status ? `HTTP ${error.status}: ` : ''}${error.message}`;
  return error instanceof Error ? error.message : fallback;
}

function UsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [filters, setFilters] = useState<UsersFilters>(() =>
    parseUsersFilters(new URLSearchParams(searchParams.toString())),
  );
  const [searchInput, setSearchInput] = useState(filters.search);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
  const latestListRequestRef = useRef(new LatestUsersRequest());
  const latestDetailsRequestRef = useRef(new LatestUsersRequest());
  const mutationLockRef = useRef(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(
    null,
  );
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsTrigger, setDetailsTrigger] =
    useState<HTMLButtonElement | null>(null);
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    void restoreAdminSession()
      .then(setAdmin)
      .catch(() => {
        clearAdminSession();
        router.replace('/login');
      });
  }, [router]);

  useEffect(() => {
    const next = parseUsersFilters(
      new URLSearchParams(searchParams.toString()),
    );
    setFilters((current) =>
      buildUsersQuery(current) === buildUsersQuery(next) ? current : next,
    );
    setSearchInput(next.search);
  }, [searchParams]);

  useEffect(() => () => {
    latestListRequestRef.current.abort();
    latestDetailsRequestRef.current.abort();
  }, []);

  const loadUsers = useCallback(async () => {
    if (!admin) return;
    const { controller, requestId } = latestListRequestRef.current.begin();
    hasLoadedRef.current ? setIsRefreshing(true) : setIsLoading(true);
    setError('');
    try {
      const response = await adminAuthenticatedRequest<UsersResponse>(
        `/admin/users?${buildUsersQuery(filters)}`,
        { signal: controller.signal },
      );
      if (!latestListRequestRef.current.isLatest(requestId)) return;
      const responseUsers = Array.isArray(response?.users)
        ? response.users
        : [];
      const responseTotal = Number.isFinite(Number(response?.pagination?.total))
        ? Math.max(0, Number(response.pagination.total))
        : 0;
      const responseTotalPages = Number.isFinite(
        Number(response?.pagination?.totalPages),
      )
        ? Math.max(0, Math.floor(Number(response.pagination.totalPages)))
        : 0;
      const normalizedPage = normalizeUsersPage(
        filters.page,
        responseTotalPages,
      );
      if (normalizedPage !== filters.page) {
        setFilters((current) => ({ ...current, page: normalizedPage }));
        return;
      }
      setUsers(responseUsers);
      setTotal(responseTotal);
      setTotalPages(responseTotalPages);
      setHasNext(Boolean(response?.pagination?.hasNextPage));
      setHasPrevious(Boolean(response?.pagination?.hasPreviousPage));
      hasLoadedRef.current = true;
      setHasLoaded(true);
      setAnnouncement(`${responseTotal} matching users loaded.`);
    } catch (requestError) {
      if (!latestListRequestRef.current.isLatest(requestId)) return;
      setError(errorMessage(requestError, 'Unable to load users'));
    } finally {
      if (latestListRequestRef.current.isLatest(requestId)) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [admin, filters]);

  useEffect(() => {
    if (!admin) return;
    const query = buildUsersUrlQuery(filters);
    router.replace(`/users?${query}`, { scroll: false });
    void loadUsers();
  }, [admin, filters, loadUsers, router]);

  const filterCount = useMemo(() => activeUsersFilterCount(filters), [filters]);
  const start = total ? (filters.page - 1) * filters.limit + 1 : 0;
  const end = Math.min(filters.page * filters.limit, total);

  function updateFilters(next: Partial<UsersFilters>, resetPage = true) {
    setFilters((current) => ({
      ...current,
      ...next,
      page: resetPage ? 1 : (next.page ?? current.page),
    }));
  }
  function clearFilters() {
    setSearchInput('');
    setFilters((current) => clearUsersFilters(current));
  }

  const loadDetails = useCallback(async (userId: string) => {
    const { controller, requestId } = latestDetailsRequestRef.current.begin();
    setDetailsLoading(true);
    setDetailsError('');
    try {
      const details = await adminAuthenticatedRequest<AdminUserDetails>(
        `/admin/users/${userId}`,
        { signal: controller.signal },
      );
      if (!latestDetailsRequestRef.current.isLatest(requestId)) return;
      if (!details || typeof details !== 'object' || !details.id) {
        throw new Error('User details response was empty');
      }
      setSelectedUser(details);
    } catch (requestError) {
      if (!latestDetailsRequestRef.current.isLatest(requestId)) return;
      setDetailsError(
        errorMessage(requestError, 'Unable to load user details'),
      );
    } finally {
      if (latestDetailsRequestRef.current.isLatest(requestId)) setDetailsLoading(false);
    }
  }, []);
  const openDetails = useCallback(
    (userId: string, trigger: HTMLButtonElement) => {
      setSuccessMessage('');
      setDetailsTrigger(trigger);
      setDetailsUserId(userId);
      setSelectedUser(null);
      setDetailsOpen(true);
      void loadDetails(userId);
    },
    [loadDetails],
  );
  const closeDetails = useCallback(() => {
    if (mutationLockRef.current) return;
    latestDetailsRequestRef.current.abort();
    setDetailsOpen(false);
    setPendingStatus(null);
    setDetailsError('');
  }, []);
  const retryDetails = useCallback(() => {
    if (detailsUserId) void loadDetails(detailsUserId);
  }, [detailsUserId, loadDetails]);
  const requestStatus = useCallback((status: UserStatus) => {
    setStatusError('');
    setPendingStatus(status);
  }, []);
  const cancelStatus = useCallback(() => {
    if (mutationLockRef.current) return;
    setPendingStatus(null);
    setStatusError('');
  }, []);

  async function updateStatus() {
    if (
      !selectedUser ||
      !pendingStatus ||
      !acquireMutationLock(mutationLockRef)
    )
      return;
    setIsStatusUpdating(true);
    setStatusError('');
    setSuccessMessage('');
    try {
      const response = await adminAuthenticatedRequest<{
        message: string;
        user: AdminUserDetails;
      }>(`/admin/users/${selectedUser.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: pendingStatus }),
      });
      if (!response?.user?.status) {
        throw new Error('User status response was incomplete');
      }
      setSelectedUser((current) =>
        current
          ? { ...current, ...response.user, status: response.user.status }
          : response.user,
      );
      setPendingStatus(null);
      setAnnouncement(response.message);
      setSuccessMessage(response.message);
      await loadUsers();
    } catch (requestError) {
      setStatusError(
        errorMessage(requestError, 'Unable to update user status'),
      );
    } finally {
      mutationLockRef.current = false;
      setIsStatusUpdating(false);
    }
  }

  async function handleLogout() {
    await logoutAdmin();
    router.push('/login');
    router.refresh();
  }
  if (!admin)
    return (
      <main aria-busy="true" className="min-h-screen bg-[#F6F8FA] p-6">
        <div className="mx-auto max-w-7xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-32" />
          <Skeleton className="mt-5 h-96" />
        </div>
      </main>
    );

  return (
    <AdminShell admin={admin} onLogout={() => void handleLogout()}>
      <PageHeader
        eyebrow="User management"
        title="Users"
        description="Search, review and manage Payflow customer accounts."
        actions={
          <Button
            disabled={isLoading || isRefreshing}
            onClick={() => void loadUsers()}
          >
            <RefreshIcon
              className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />
      <section
        aria-label="User result summary"
        className="mt-6 grid gap-3 sm:grid-cols-3"
      >
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Matching users
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 tabular-nums">
            {total}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current results
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 tabular-nums">
            {total ? `${start}–${end}` : '0'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active filters
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 tabular-nums">
            {filterCount}
          </p>
        </Card>
      </section>
      <UsersFilterBar
        searchInput={searchInput}
        status={filters.status}
        role={filters.role}
        limit={filters.limit}
        activeCount={filterCount}
        disabled={isLoading}
        onSearchInput={setSearchInput}
        onStatus={(status) => updateFilters({ status })}
        onRole={(role) => updateFilters({ role })}
        onLimit={(limit) => updateFilters({ limit })}
        onSearch={() => updateFilters({ search: searchInput.trim() })}
        onClear={clearFilters}
      />
      {error ? (
        <div className="mt-5">
          <ErrorState message={error} onRetry={() => void loadUsers()} />
        </div>
      ) : null}
      {successMessage ? (
        <div
          role="status"
          className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {successMessage}
        </div>
      ) : null}
      <section
        aria-labelledby="users-list-title"
        className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-slate-50 text-slate-600">
              <UsersIcon className="size-5" />
            </span>
            <div>
              <h2
                id="users-list-title"
                className="text-base font-semibold text-slate-900"
              >
                Users list
              </h2>
              <p className="text-sm text-slate-500">
                {isRefreshing
                  ? 'Refreshing current results…'
                  : `${total} matching users`}
              </p>
            </div>
          </div>
        </div>
        <UsersTable
          users={users}
          initialLoading={isLoading && !hasLoaded}
          filtered={filterCount > 0}
          onDetails={openDetails}
          onClear={clearFilters}
        />
        <UsersPagination
          page={filters.page}
          totalPages={totalPages}
          total={total}
          start={start}
          end={end}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          disabled={isLoading || isRefreshing}
          onPage={(page) => updateFilters({ page }, false)}
        />
      </section>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <UserDetailsDialog
        open={detailsOpen}
        user={selectedUser}
        isLoading={detailsLoading}
        error={detailsError}
        onClose={closeDetails}
        onRetry={retryDetails}
        onStatus={requestStatus}
        returnFocus={detailsTrigger}
      />
      <UserStatusConfirmDialog
        user={selectedUser}
        status={pendingStatus}
        open={Boolean(pendingStatus)}
        isUpdating={isStatusUpdating}
        error={statusError}
        onCancel={cancelStatus}
        onConfirm={() => void updateStatus()}
      />
    </AdminShell>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <main aria-busy="true" className="min-h-screen bg-[#F6F8FA] p-6">
          <Skeleton className="h-96" />
        </main>
      }
    >
      <UsersPageContent />
    </Suspense>
  );
}
