export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export type AnalyticsSummaryData = {
  totalTransactions: number;
  completedTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
  reversedTransactions: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalTransfers: number;
  newUsers: number;
  newWallets: number;
  successRate: number;
};

export type DailyActivity = {
  date: string;
  label: string;
  deposits: number;
  withdrawals: number;
  transfers: number;
  transactionCount: number;
  newUsers: number;
  newWallets: number;
};

export type DistributionItem = { name: string; value: number };

export type AnalyticsData = {
  period: { days: AnalyticsPeriod; startDate: string; endDate: string };
  summary: AnalyticsSummaryData;
  transactionTypes: DistributionItem[];
  transactionStatuses: DistributionItem[];
  dailyActivity: DailyActivity[];
};
