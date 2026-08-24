import { render, screen } from '@testing-library/react';
import { AnalyticsCharts } from './analytics-charts';
import { AnalyticsDataTable } from './analytics-data-table';
import { AnalyticsSummary } from './analytics-summary';
import {
  buildAnalyticsRequest,
  buildAnalyticsUrl,
  hasAnalyticsData,
  LatestAnalyticsRequest,
  normalizeAnalyticsResponse,
  parseAnalyticsPeriod,
} from './helpers';

const response = {
  period: { days: 30, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-30T00:00:00.000Z' },
  summary: {
    totalTransactions: 12, completedTransactions: 8, failedTransactions: 1,
    pendingTransactions: 2, reversedTransactions: 1, totalDeposits: 4,
    totalWithdrawals: 3, totalTransfers: 5, newUsers: 6, newWallets: 7,
    successRate: 66.67, totalVolume: '999999.99', totalDepositAmount: '500000.00',
  },
  transactionTypes: [
    { type: 'DEPOSIT', count: 4, amount: '500000.00' },
    { type: 'WITHDRAWAL', count: 3, amount: '1.00' },
    { type: 'TRANSFER', count: 5, amount: '499998.99' },
    { type: 'PAYMENT', count: 99, amount: '999.00' },
  ],
  transactionStatuses: [
    { status: 'COMPLETED', count: 8 }, { status: 'FAILED', count: 1 },
    { status: 'PENDING', count: 1 }, { status: 'PROCESSING', count: 1 },
    { status: 'REVERSED', count: 1 }, { status: 'UNKNOWN', count: 50 },
  ],
  dailyActivity: [{
    date: '2026-01-01', deposits: 2, withdrawals: 1, transfers: 3,
    transactionCount: 6, newUsers: 4, newWallets: 5,
    depositAmount: '900.00', transactionVolume: '999.00',
  }],
};

describe('Analytics management', () => {
  it('normalizes count metrics and intentionally omits monetary fields', () => {
    const data = normalizeAnalyticsResponse(response);
    expect(data.summary).toEqual({
      totalTransactions: 12, completedTransactions: 8, failedTransactions: 1,
      pendingTransactions: 2, reversedTransactions: 1, totalDeposits: 4,
      totalWithdrawals: 3, totalTransfers: 5, newUsers: 6, newWallets: 7,
      successRate: 66.67,
    });
    expect(data.dailyActivity[0]).not.toHaveProperty('depositAmount');
    expect(data).not.toHaveProperty('totalVolume');
  });

  it('defensively normalizes missing, null and invalid values', () => {
    const data = normalizeAnalyticsResponse({
      summary: { totalTransactions: -1, newUsers: null, successRate: 200 },
      dailyActivity: [null, { date: 'invalid', deposits: 5 }],
    });
    expect(data.summary.totalTransactions).toBe(0);
    expect(data.summary.newUsers).toBe(0);
    expect(data.summary.successRate).toBe(100);
    expect(data.dailyActivity).toEqual([]);
    expect(hasAnalyticsData(data)).toBe(false);
  });

  it('ignores unknown transaction types and statuses', () => {
    const data = normalizeAnalyticsResponse(response);
    expect(data.transactionTypes.map((item) => item.name)).toEqual(['Deposits', 'Withdrawals', 'Transfers']);
    expect(data.transactionStatuses).toEqual([
      { name: 'Completed', value: 8 }, { name: 'Failed', value: 1 },
      { name: 'Pending / Processing', value: 2 }, { name: 'Reversed', value: 1 },
    ]);
  });

  it('normalizes period parsing and constructs URL and API queries', () => {
    expect(parseAnalyticsPeriod('90')).toBe(90);
    expect(parseAnalyticsPeriod('14')).toBe(7);
    expect(parseAnalyticsPeriod(null)).toBe(7);
    expect(buildAnalyticsUrl(30)).toBe('/analytics?days=30');
    expect(buildAnalyticsRequest(30)).toBe('/admin/analytics?days=30');
  });

  it('cancels stale requests and accepts only the latest response', () => {
    const requests = new LatestAnalyticsRequest();
    const first = requests.begin();
    const second = requests.begin();
    expect(first.controller.signal.aborted).toBe(true);
    expect(requests.isLatest(first.requestId)).toBe(false);
    expect(requests.isLatest(second.requestId)).toBe(true);
    requests.abort();
    expect(second.controller.signal.aborted).toBe(true);
  });

  it('renders all safe KPIs with the pending/processing label', () => {
    const data = normalizeAnalyticsResponse(response);
    render(<AnalyticsSummary summary={data.summary} />);
    expect(screen.getByText('Transactions')).toBeTruthy();
    expect(screen.getByText('Pending / Processing')).toBeTruthy();
    expect(screen.getByText('New Users')).toBeTruthy();
    expect(screen.getByText('New Wallets')).toBeTruthy();
  });

  it('provides an accessible table equivalent for all chart series', () => {
    const data = normalizeAnalyticsResponse(response);
    render(<AnalyticsDataTable data={data} />);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Deposits')).toBeTruthy();
    expect(screen.getByText('New users')).toBeTruthy();
    expect(screen.getByText('New wallets')).toBeTruthy();
    expect(screen.queryByText(/999999/)).toBeNull();
  });

  it('labels count-only charts for assistive technology', () => {
    const data = normalizeAnalyticsResponse(response);
    render(<AnalyticsCharts data={data} />);
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.getByRole('img', { name: /daily deposits, withdrawals and transfers/i })).toBeTruthy();
    expect(screen.queryByText(/volume|amount|INR|revenue|profit/i)).toBeNull();
  });
});
