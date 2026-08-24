import { render, waitFor } from '@testing-library/react';
import AuditLogsPage from '../../audit-logs/page';
import { adminAuthenticatedRequest, restoreAdminSession } from '../../lib/api';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams('page=1&pageSize=20&targetType=ALL'),
  usePathname: () => '/audit-logs',
}));
jest.mock('../../lib/api', () => ({
  AdminApiError: class AdminApiError extends Error { constructor(readonly status: number, message: string) { super(message); } },
  adminAuthenticatedRequest: jest.fn(), clearAdminSession: jest.fn(),
  logoutAdmin: jest.fn().mockResolvedValue(undefined), restoreAdminSession: jest.fn(),
}));

describe('Audit Logs Admin access', () => {
  beforeEach(() => jest.clearAllMocks());
  it('redirects without requesting audit data when Admin session restoration fails', async () => {
    (restoreAdminSession as jest.Mock).mockRejectedValue(new Error('unauthorized'));
    render(<AuditLogsPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(adminAuthenticatedRequest).not.toHaveBeenCalled();
  });
});
