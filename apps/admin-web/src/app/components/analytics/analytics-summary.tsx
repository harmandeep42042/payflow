import { MetricCard } from '../admin';
import { AnalyticsIcon, TransactionsIcon, UsersIcon, WalletIcon } from '../ui';
import type { AnalyticsSummaryData } from './types';

export function AnalyticsSummary({ summary }: { summary: AnalyticsSummaryData }) {
  const metrics = [
    { label: 'Transactions', value: summary.totalTransactions, description: 'All transactions in this period', icon: <TransactionsIcon className="size-5" /> },
    { label: 'Completed', value: summary.completedTransactions, description: `${summary.successRate}% success rate`, icon: <AnalyticsIcon className="size-5" /> },
    { label: 'Failed', value: summary.failedTransactions, description: 'Transactions marked failed', valueClassName: 'text-red-700', icon: <TransactionsIcon className="size-5" /> },
    { label: 'Pending / Processing', value: summary.pendingTransactions, description: 'Awaiting or undergoing processing', valueClassName: 'text-amber-700', icon: <TransactionsIcon className="size-5" /> },
    { label: 'New Users', value: summary.newUsers, description: 'Registrations in this period', icon: <UsersIcon className="size-5" /> },
    { label: 'New Wallets', value: summary.newWallets, description: 'Wallets created in this period', icon: <WalletIcon className="size-5" /> },
  ];
  return (
    <section aria-label="Analytics summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value.toLocaleString('en-IN')}
          description={metric.description}
          valueClassName={metric.valueClassName}
          icon={metric.icon}
        />
      ))}
    </section>
  );
}
