import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from '../../analytics/page';
import {
  adminAuthenticatedRequest,
  restoreAdminSession,
} from '../../lib/api';

const replace = jest.fn();
const push = jest.fn();
let query = 'days=7';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push, refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(query),
  usePathname: () => '/analytics',
}));

jest.mock('../../lib/api', () => ({
  AdminApiError: class AdminApiError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
  },
  adminAuthenticatedRequest: jest.fn(),
  clearAdminSession: jest.fn(),
  logoutAdmin: jest.fn().mockResolvedValue(undefined),
  restoreAdminSession: jest.fn(),
}));

jest.mock('./analytics-charts', () => ({
  AnalyticsCharts: () => <div aria-label="Analytics charts">Charts</div>,
}));

const admin = {
  id: 'admin', email: 'admin@payflow.test', phone: null, firstName: 'Admin',
  lastName: null, role: 'ADMIN', status: 'ACTIVE', createdAt: '', updatedAt: '',
};
const analytics = {
  period: { days: 7, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-07T00:00:00.000Z' },
  summary: {
    totalTransactions: 1, completedTransactions: 1, failedTransactions: 0,
    pendingTransactions: 0, reversedTransactions: 0, totalDeposits: 1,
    totalWithdrawals: 0, totalTransfers: 0, newUsers: 1, newWallets: 1,
    successRate: 100, totalVolume: '1000000.00',
  },
  transactionTypes: [{ type: 'DEPOSIT', count: 1, amount: '1000000.00' }],
  transactionStatuses: [{ status: 'COMPLETED', count: 1 }],
  dailyActivity: [{ date: '2026-01-01', deposits: 1, withdrawals: 0, transfers: 0, transactionCount: 1, newUsers: 1, newWallets: 1, transactionVolume: '1000000.00' }],
};

describe('Analytics page behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query = 'days=7';
    (restoreAdminSession as jest.Mock).mockResolvedValue(admin);
    (adminAuthenticatedRequest as jest.Mock).mockResolvedValue(analytics);
  });

  afterEach(() => jest.useRealTimers());

  it('loads through the Admin session, refreshes, and renders scope without money', async () => {
    render(<AnalyticsPage />);
    expect(screen.getByLabelText('Loading analytics')).toBeTruthy();
    await screen.findByText('Payment transactions are not included in the current Analytics API.');
    expect(restoreAdminSession).toHaveBeenCalled();
    expect(adminAuthenticatedRequest).toHaveBeenCalledWith('/admin/analytics?days=7', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText(/Completed transactions \/ all transactions/)).toBeTruthy();
    expect(screen.queryByText(/1000000|INR|total volume/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(adminAuthenticatedRequest).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Last updated:/).textContent).not.toContain('Not yet updated');
  });

  it('pauses and resumes the 30-second automatic refresh', async () => {
    jest.useFakeTimers();
    render(<AnalyticsPage />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await screen.findByText('Pause auto-refresh');
    const calls = (adminAuthenticatedRequest as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Pause auto-refresh' }));
    act(() => jest.advanceTimersByTime(30_000));
    expect(adminAuthenticatedRequest).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Resume auto-refresh' }));
    act(() => jest.advanceTimersByTime(30_000));
    await act(async () => { await Promise.resolve(); });
    expect((adminAuthenticatedRequest as jest.Mock).mock.calls.length).toBeGreaterThan(calls);
  });

  it('normalizes invalid URL state and restores a changed period', async () => {
    query = 'days=invalid';
    const { rerender } = render(<AnalyticsPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/analytics?days=7', { scroll: false }));
    query = 'days=90';
    rerender(<AnalyticsPage />);
    await waitFor(() => expect(adminAuthenticatedRequest).toHaveBeenCalledWith('/admin/analytics?days=90', expect.anything()));
    expect(screen.getByRole('button', { name: '90 days' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a safe error with retry and an empty state', async () => {
    (adminAuthenticatedRequest as jest.Mock).mockRejectedValueOnce(new Error('secret stack'));
    render(<AnalyticsPage />);
    expect(await screen.findByText('Unable to load analytics. Please try again.')).toBeTruthy();
    expect(screen.queryByText('secret stack')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Daily analytics data');
  });

  it('redirects to login when the Admin session cannot be restored', async () => {
    (restoreAdminSession as jest.Mock).mockRejectedValue(new Error('unauthorized'));
    render(<AnalyticsPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(adminAuthenticatedRequest).not.toHaveBeenCalled();
  });
});
