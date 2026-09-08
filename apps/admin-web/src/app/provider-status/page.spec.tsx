import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Page from './page';
import { adminAuthenticatedRequest } from '../lib/api';

jest.mock('../lib/api', () => ({
  adminAuthenticatedRequest: jest.fn(),
}));

jest.mock('../components/admin/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  ),
}));

const request = adminAuthenticatedRequest as jest.MockedFunction<
  typeof adminAuthenticatedRequest
>;

describe('Provider status admin page', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('loads provider status without exposing credentials and supports refresh', async () => {
    request.mockResolvedValue({
      providers: { razorpay: 'CONFIGURED' },
      rechargeAttempts: [],
      billAttempts: [],
    });

    render(<Page />);

    expect(await screen.findByText('razorpay')).toBeTruthy();
    expect(screen.getByText('CONFIGURED')).toBeTruthy();

    expect(request).toHaveBeenCalledWith(
      '/customer-features/admin/providers/status',
    );

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(request.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders a safe error when provider operations cannot load', async () => {
    request.mockRejectedValueOnce(new Error('Unable to load provider operations'));

    render(<Page />);

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toContain(
      'Unable to load provider operations',
    );
  });
});