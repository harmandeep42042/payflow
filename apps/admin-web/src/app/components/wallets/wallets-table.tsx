import { Button, Skeleton, StatusBadge } from '../ui';
import { formatWalletBalance, formatWalletDate, getWalletOwnerName } from './helpers';
import type { AdminWallet } from './types';

function RowsSkeleton() {
  return <>{Array.from({ length: 6 }, (_, row) => <tr key={row}>{Array.from({ length: 8 }, (_, cell) => <td className="px-4 py-3" key={cell}><Skeleton className="h-5 w-full max-w-28" /></td>)}</tr>)}</>;
}
export function WalletsTable({ wallets, initialLoading, filtered, onDetails, onClear }: {
  wallets: AdminWallet[]; initialLoading: boolean; filtered: boolean;
  onDetails: (wallet: AdminWallet, trigger: HTMLButtonElement) => void; onClear: () => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table aria-busy={initialLoading} className="w-full min-w-[960px] text-left text-[13px]">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Wallet / owner</th>
            <th scope="col" className="px-4 py-3 font-semibold">Contact</th>
            <th scope="col" className="px-4 py-3 font-semibold">Currency</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Balance</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Transactions</th>
            <th scope="col" className="px-4 py-3 font-semibold">Created</th>
            <th scope="col" className="px-5 py-3 text-right font-semibold sm:px-6">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {initialLoading ? <RowsSkeleton /> : wallets.length ? wallets.map((wallet) => (
            <tr className="hover:bg-slate-50/70" key={wallet.id}>
              <th scope="row" className="px-5 py-3 sm:px-6">
                <p className="font-medium text-slate-900">{getWalletOwnerName(wallet)}</p>
                <p className="mt-0.5 max-w-44 truncate text-xs font-normal text-slate-400" title={wallet.id}>ID {wallet.id.slice(0, 10)}…</p>
              </th>
              <td className="px-4 py-3"><p className="max-w-52 truncate text-slate-700" title={wallet.user.email}>{wallet.user.email}</p><p className="mt-0.5 text-xs text-slate-500">{wallet.user.phone ?? 'No phone'}</p></td>
              <td className="px-4 py-3 font-medium text-slate-700">{wallet.currency}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatWalletBalance(wallet.balance)}</td>
              <td className="px-4 py-3"><StatusBadge status={wallet.status} /></td>
              <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums">{wallet.transactionCount}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500 tabular-nums">{formatWalletDate(wallet.createdAt)}</td>
              <td className="px-5 py-3 text-right sm:px-6"><Button size="sm" variant="secondary" onClick={(event) => onDetails(wallet, event.currentTarget)}>View details</Button></td>
            </tr>
          )) : <tr><td colSpan={8} className="px-5 py-14 text-center"><p className="font-medium text-slate-800">{filtered ? 'No wallets match these filters' : 'No wallets exist yet'}</p><p className="mt-1 text-sm text-slate-500">{filtered ? 'Adjust or clear the filters to see more wallets.' : 'Payflow wallets will appear here.'}</p>{filtered ? <Button className="mt-4" variant="secondary" onClick={onClear}>Clear filters</Button> : null}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
