'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  AdminUserDetails,
  UserDetailsModal,
} from '../components/user-details-modal';

import {
  adminAuthenticatedRequest,
  clearAdminSession,
  getStoredAdmin,
  hasValidAdminSession,
} from '../lib/api';

type UserWallet = {
  id: string;
  currency: string;
  balance: string;
  status: string;
  createdAt: string;
};

type AdminUserItem = {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
  role: 'USER' | 'ADMIN';
  status:
    | 'ACTIVE'
    | 'BLOCKED'
    | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
  wallets: UserWallet[];
  walletCount: number;
  totalWalletBalance: string;
};

type UsersResponse = {
  users: AdminUserItem[];

  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  filters: {
    search: string;
    status: string;
    role: string;
  };
};

function formatMoney(
  amount: string,
): string {
  return Number(amount).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
}

export default function UsersPage() {
  const router = useRouter();

  const [users, setUsers] =
    useState<AdminUserItem[]>([]);

  const [searchInput, setSearchInput] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [status, setStatus] =
    useState('ALL');

  const [role, setRole] =
    useState('ALL');

  const [page, setPage] =
    useState(1);

  const [limit] =
    useState(10);

  const [total, setTotal] =
    useState(0);

  const [totalPages, setTotalPages] =
    useState(0);

  const [hasNextPage, setHasNextPage] =
    useState(false);

  const [
    hasPreviousPage,
    setHasPreviousPage,
  ] = useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [
    selectedUser,
    setSelectedUser,
  ] =
    useState<AdminUserDetails | null>(
      null,
    );

  const [
    isDetailsLoading,
    setIsDetailsLoading,
  ] = useState(false);

  const [
    isStatusUpdating,
    setIsStatusUpdating,
  ] = useState(false);

  const [
    detailsError,
    setDetailsError,
  ] = useState('');

  const loadUsers = useCallback(
    async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError('');

        const query =
          new URLSearchParams({
            page: String(page),
            limit: String(limit),
            search,
            status,
            role,
          });

        const response =
          await adminAuthenticatedRequest<UsersResponse>(
            `/admin/users?${query.toString()}`,
          );

        setUsers(response.users);
        setTotal(
          response.pagination.total,
        );
        setTotalPages(
          response.pagination.totalPages,
        );
        setHasNextPage(
          response.pagination.hasNextPage,
        );
        setHasPreviousPage(
          response.pagination
            .hasPreviousPage,
        );
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load users';

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
      limit,
      page,
      role,
      router,
      search,
      status,
    ],
  );

  useEffect(() => {
    if (!hasValidAdminSession()) {
      router.replace('/login');
      return;
    }

    const admin = getStoredAdmin();

    if (!admin) {
      clearAdminSession();
      router.replace('/login');
      return;
    }

    void loadUsers();
  }, [
    loadUsers,
    router,
  ]);

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    setPage(1);
    setSearch(
      searchInput.trim(),
    );
  }

  function clearFilters(): void {
    setSearchInput('');
    setSearch('');
    setStatus('ALL');
    setRole('ALL');
    setPage(1);
  }

  async function openUserDetails(
    userId: string,
  ): Promise<void> {
    try {
      setIsDetailsLoading(true);
      setDetailsError('');

      const response =
        await adminAuthenticatedRequest<AdminUserDetails>(
          `/admin/users/${userId}`,
        );

      setSelectedUser(response);
    } catch (requestError) {
      setDetailsError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load user details',
      );
    } finally {
      setIsDetailsLoading(false);
    }
  }

  async function updateSelectedUserStatus(
    newStatus:
      | 'ACTIVE'
      | 'BLOCKED'
      | 'SUSPENDED',
  ): Promise<void> {
    if (!selectedUser) {
      return;
    }

    try {
      setIsStatusUpdating(true);
      setDetailsError('');

      const response =
        await adminAuthenticatedRequest<{
          message: string;
          user: AdminUserDetails;
        }>(
          `/admin/users/${selectedUser.id}/status`,
          {
            method: 'PATCH',

            body: JSON.stringify({
              status: newStatus,
            }),
          },
        );

      setSelectedUser({
        ...selectedUser,
        ...response.user,
        status: response.user.status,
      });

      await loadUsers();
    } catch (requestError) {
      setDetailsError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update user status',
      );
    } finally {
      setIsStatusUpdating(false);
    }
  }

  function closeUserDetails(): void {
    setSelectedUser(null);
    setDetailsError('');
  }

  function handleLogout(): void {
    clearAdminSession();
    router.push('/login');
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
              Users Management
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                router.push('/dashboard')
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
            Administration
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Payflow users
          </h2>

          <p className="mt-2 text-slate-600">
            Search and review all registered users.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form
            onSubmit={handleSearch}
            className="grid gap-4 lg:grid-cols-[1fr_180px_180px_auto_auto]"
          >
            <input
              type="text"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  event.target.value,
                )
              }
              placeholder="Search by name, email or phone"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />

            <select
              value={status}
              onChange={(event) => {
                setStatus(
                  event.target.value,
                );
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="ACTIVE">
                Active
              </option>
              <option value="BLOCKED">
                Blocked
              </option>
              <option value="SUSPENDED">
                Suspended
              </option>
            </select>

            <select
              value={role}
              onChange={(event) => {
                setRole(
                  event.target.value,
                );
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
            >
              <option value="ALL">
                All roles
              </option>
              <option value="USER">
                Users
              </option>
              <option value="ADMIN">
                Admins
              </option>
            </select>

            <button
              type="submit"
              className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-600"
            >
              Search
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
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
                Users list
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Total users: {total}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadUsers()
              }
              className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center font-semibold text-slate-500">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">
                      User
                    </th>
                    <th className="px-6 py-4">
                      Contact
                    </th>
                    <th className="px-6 py-4">
                      Role
                    </th>
                    <th className="px-6 py-4">
                      Status
                    </th>
                    <th className="px-6 py-4">
                      Wallets
                    </th>
                    <th className="px-6 py-4">
                      Balance
                    </th>
                    <th className="px-6 py-4">
                      Joined
                    </th>

                    <th className="px-6 py-4">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-900">
                          {user.firstName}{' '}
                          {user.lastName ?? ''}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {user.id}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-sm text-slate-700">
                          {user.email}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {user.phone ?? 'No phone'}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                          {user.role}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            user.status ===
                            'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : user.status ===
                                  'BLOCKED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>

                      <td className="px-6 py-5 font-semibold text-slate-700">
                        {user.walletCount}
                      </td>

                      <td className="px-6 py-5 font-bold text-slate-900">
                        INR{' '}
                        {formatMoney(
                          user.totalWalletBalance,
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-5 text-sm text-slate-500">
                        {new Date(
                          user.createdAt,
                        ).toLocaleDateString(
                          'en-IN',
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <button
                          type="button"
                          onClick={() =>
                            void openUserDetails(
                              user.id,
                            )
                          }
                          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
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
      <UserDetailsModal
        user={selectedUser}
        isLoading={isDetailsLoading}
        isUpdating={isStatusUpdating}
        error={detailsError}
        onClose={closeUserDetails}
        onUpdateStatus={
          updateSelectedUserStatus
        }
      />
    </main>
  );
}