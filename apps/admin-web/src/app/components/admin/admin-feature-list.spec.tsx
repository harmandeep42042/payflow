import { render, screen, waitFor } from '@testing-library/react';
import { AdminFeatureList } from './admin-feature-list';
import { adminAuthenticatedRequest } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  adminAuthenticatedRequest: jest.fn(),
}));

const request = adminAuthenticatedRequest as jest.MockedFunction<
  typeof adminAuthenticatedRequest
>;

describe('AdminFeatureList', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('loads a configured read-only admin feature endpoint', async () => {
    request.mockResolvedValueOnce([]);

    render(
      <AdminFeatureList
        title="AutoPay mandates"
        description="Read-only mandate visibility."
        endpoint="/mandates"
      />,
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/customer-features/admin/mandates');
    });

    expect(screen.getByText('AutoPay mandates')).toBeTruthy();
  });

  it('shows a safe error when the feature request fails', async () => {
    request.mockRejectedValueOnce(new Error('Unable to load feature'));

    render(
      <AdminFeatureList
        title="Bill splits"
        description="Read-only split visibility."
        endpoint="/splits"
      />,
    );

    expect(
      await screen.findByText(/Unable to load feature/i),
    ).toBeTruthy();
  });
});