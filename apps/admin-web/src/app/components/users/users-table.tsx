import { Button, Skeleton, StatusBadge } from '../ui';
import {
  formatCurrencyAmount,
  formatUserDate,
  getUserDisplayName,
  getWalletBalances,
} from './helpers';
import type { AdminUserItem } from './types';

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <tr key={index}>
          {Array.from({ length: 8 }, (_, cell) => (
            <td className="px-4 py-3" key={cell}>
              <Skeleton className="h-5 w-full max-w-28" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function WalletBalances({ user }: { user: AdminUserItem }) {
  const balances = getWalletBalances(user.wallets);
  if (!balances.length)
    return <span className="text-slate-400">Unavailable</span>;
  return (
    <>
      {balances.map((balance) => (
        <span className="block whitespace-nowrap" key={balance.currency}>
          {formatCurrencyAmount(balance.currency, balance.amount)}
        </span>
      ))}
    </>
  );
}

export function UsersTable({
  users,
  initialLoading,
  filtered,
  onDetails,
  onClear,
}: {
  users: AdminUserItem[];
  initialLoading: boolean;
  filtered: boolean;
  onDetails: (userId: string, trigger: HTMLButtonElement) => void;
  onClear: () => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        aria-busy={initialLoading}
        className="w-full min-w-[900px] text-left text-[13px]"
      >
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
              User
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Contact
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Role
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Wallets
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Balance
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Registered
            </th>
            <th
              scope="col"
              className="px-5 py-3 text-right font-semibold sm:px-6"
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {initialLoading ? (
            <TableSkeleton />
          ) : users.length ? (
            users.map((user) => (
              <tr className="hover:bg-slate-50/70" key={user.id}>
                <th scope="row" className="px-5 py-3 sm:px-6">
                  <p className="font-medium text-slate-900">
                    {getUserDisplayName(user)}
                  </p>
                  <p
                    className="mt-0.5 max-w-36 truncate text-xs font-normal text-slate-400"
                    title={user.id}
                  >
                    ID {user.id.slice(0, 8)}…
                  </p>
                </th>
                <td className="px-4 py-3">
                  <p
                    className="max-w-52 truncate text-slate-700"
                    title={user.email}
                  >
                    {user.email}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {user.phone ?? 'No phone'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums">
                  {user.walletCount}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                  <WalletBalances user={user} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500 tabular-nums">
                  {formatUserDate(user.createdAt)}
                </td>
                <td className="px-5 py-3 text-right sm:px-6">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => onDetails(user.id, event.currentTarget)}
                  >
                    View details
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="px-5 py-14 text-center">
                <p className="font-medium text-slate-800">
                  {filtered
                    ? 'No users match these filters'
                    : 'No users exist yet'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {filtered
                    ? 'Adjust or clear the filters to see more users.'
                    : 'Registered Payflow users will appear here.'}
                </p>
                {filtered ? (
                  <Button
                    className="mt-4"
                    variant="secondary"
                    onClick={onClear}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
