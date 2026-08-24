import { Card } from '../ui';
import type { AnalyticsData } from './types';

export function AnalyticsDataTable({ data }: { data: AnalyticsData }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-slate-900">Daily analytics data</h2>
        <p className="mt-1 text-sm text-slate-500">Accessible count-based equivalent of the charts.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[52rem] w-full text-left text-sm">
          <caption className="sr-only">Daily deposits, withdrawals, transfers, users and wallets</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {['Date', 'Transactions', 'Deposits', 'Withdrawals', 'Transfers', 'New users', 'New wallets'].map((label) => (
                <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {data.dailyActivity.map((item) => (
              <tr key={item.date}>
                <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.label}</th>
                {[item.transactionCount, item.deposits, item.withdrawals, item.transfers, item.newUsers, item.newWallets].map((value, index) => (
                  <td key={index} className="px-4 py-3 tabular-nums">{value.toLocaleString('en-IN')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
