import { LatestDashboardRequest, normalizeDashboard } from './helpers';

describe('Dashboard safety', () => {
  it('normalizes malformed responses and excludes unsafe aggregate money', () => {
    const data = normalizeDashboard({ stats: { totalUsers: '3', totalBalance: '999.00', totalDepositAmount: '5.00' }, recentUsers: null, recentTransactions: [{}] });
    expect(data.stats.totalUsers).toBe(3); expect(data.recentUsers).toEqual([]); expect(data.recentTransactions).toEqual([]);
    expect(data.stats).not.toHaveProperty('totalBalance'); expect(data.stats).not.toHaveProperty('totalDepositAmount');
  });
  it('preserves exact transaction decimals and currency without assigning direction', () => {
    const data = normalizeDashboard({ recentTransactions: [{ id: 'id', type: 'TRANSFER', amount: '9007199254740993.11', currency: 'usd' }] });
    expect(data.recentTransactions[0]).toMatchObject({ amount: '9007199254740993.11', currency: 'USD', type: 'TRANSFER' });
  });
  it('cancels stale dashboard refreshes', () => {
    const latest = new LatestDashboardRequest(); const first = latest.begin(); const second = latest.begin();
    expect(first.controller.signal.aborted).toBe(true); expect(latest.isLatest(first.requestId)).toBe(false); expect(latest.isLatest(second.requestId)).toBe(true); latest.abort(); expect(second.controller.signal.aborted).toBe(true);
  });
});
