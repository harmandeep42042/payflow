import {
  ANALYTICS_PERIODS,
  type AnalyticsData,
  type AnalyticsPeriod,
  type AnalyticsSummaryData,
  type DailyActivity,
  type DistributionItem,
} from './types';

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposits',
  WITHDRAWAL: 'Withdrawals',
  TRANSFER: 'Transfers',
};
const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  PENDING: 'Pending / Processing',
  PROCESSING: 'Pending / Processing',
  REVERSED: 'Reversed',
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function count(value: unknown): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate >= 0
    ? Math.floor(candidate)
    : 0;
}

function percentage(value: unknown): number {
  const candidate = Number(value);
  return Number.isFinite(candidate)
    ? Math.min(100, Math.max(0, candidate))
    : 0;
}

function dateValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : value;
}

export function formatAnalyticsDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return 'Unavailable';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function parseAnalyticsPeriod(value: string | null): AnalyticsPeriod {
  const candidate = Number(value);
  return ANALYTICS_PERIODS.includes(candidate as AnalyticsPeriod)
    ? (candidate as AnalyticsPeriod)
    : 7;
}

export function buildAnalyticsUrl(period: AnalyticsPeriod): string {
  return `/analytics?days=${period}`;
}

export function buildAnalyticsRequest(period: AnalyticsPeriod): string {
  return `/admin/analytics?days=${period}`;
}

function normalizeSummary(value: unknown): AnalyticsSummaryData {
  const item = record(value);
  return {
    totalTransactions: count(item?.totalTransactions),
    completedTransactions: count(item?.completedTransactions),
    failedTransactions: count(item?.failedTransactions),
    pendingTransactions: count(item?.pendingTransactions),
    reversedTransactions: count(item?.reversedTransactions),
    totalDeposits: count(item?.totalDeposits),
    totalWithdrawals: count(item?.totalWithdrawals),
    totalTransfers: count(item?.totalTransfers),
    newUsers: count(item?.newUsers),
    newWallets: count(item?.newWallets),
    successRate: percentage(item?.successRate),
  };
}

function normalizeDistribution(
  value: unknown,
  key: 'type' | 'status',
  labels: Record<string, string>,
): DistributionItem[] {
  if (!Array.isArray(value)) return [];
  const totals = new Map<string, number>();
  for (const candidate of value) {
    const item = record(candidate);
    const raw = typeof item?.[key] === 'string'
      ? item[key].trim().toUpperCase()
      : '';
    const label = labels[raw];
    if (!label) continue;
    totals.set(label, (totals.get(label) ?? 0) + count(item?.count));
  }
  return Array.from(totals, ([name, itemCount]) => ({
    name,
    value: itemCount,
  }));
}

function normalizeDaily(value: unknown): DailyActivity[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const item = record(candidate);
    const date = typeof item?.date === 'string' ? item.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || formatAnalyticsDate(date) === 'Unavailable') {
      return [];
    }
    return [{
      date,
      label: formatAnalyticsDate(date),
      deposits: count(item?.deposits),
      withdrawals: count(item?.withdrawals),
      transfers: count(item?.transfers),
      transactionCount: count(item?.transactionCount),
      newUsers: count(item?.newUsers),
      newWallets: count(item?.newWallets),
    }];
  });
}

export function normalizeAnalyticsResponse(value: unknown): AnalyticsData {
  const response = record(value);
  const period = record(response?.period);
  return {
    period: {
      days: parseAnalyticsPeriod(String(period?.days ?? '7')),
      startDate: dateValue(period?.startDate),
      endDate: dateValue(period?.endDate),
    },
    summary: normalizeSummary(response?.summary),
    transactionTypes: normalizeDistribution(
      response?.transactionTypes,
      'type',
      TYPE_LABELS,
    ),
    transactionStatuses: normalizeDistribution(
      response?.transactionStatuses,
      'status',
      STATUS_LABELS,
    ),
    dailyActivity: normalizeDaily(response?.dailyActivity),
  };
}

export function hasAnalyticsData(data: AnalyticsData): boolean {
  const summary = data.summary;
  return data.dailyActivity.length > 0 || [
    summary.totalTransactions,
    summary.newUsers,
    summary.newWallets,
  ].some((value) => value > 0);
}

export class LatestAnalyticsRequest {
  private controller: AbortController | null = null;
  private sequence = 0;

  begin() {
    this.controller?.abort();
    this.controller = new AbortController();
    return { controller: this.controller, requestId: ++this.sequence };
  }

  isLatest(requestId: number): boolean {
    return requestId === this.sequence && !this.controller?.signal.aborted;
  }

  abort(): void {
    this.controller?.abort();
  }
}
