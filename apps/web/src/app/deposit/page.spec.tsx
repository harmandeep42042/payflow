import { render, screen, waitFor } from '@testing-library/react';

import DepositPage from './page';
import { userAuthenticatedRequest } from '../lib/api';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

jest.mock('../lib/api', () => ({
  getStoredUser: () => ({ id: 'customer-1' }),
  hasValidUserSession: () => true,
  userAuthenticatedRequest: jest.fn(),
}));

describe('DepositPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(userAuthenticatedRequest).mockImplementation(
      async (path) => {
        const requestPath = String(path);

        if (requestPath.startsWith('/wallets/user/')) {
          return [{
            id: 'wallet-1',
            userId: 'customer-1',
            balance: '100.00',
            currency: 'INR',
            status: 'ACTIVE',
          }];
        }

        throw new Error(`Unexpected API request: ${requestPath}`);
      },
    );
  });

  it('shows mock-provider disclosure without creating a payment', async () => {
    render(<DepositPage />);

    expect(await screen.findByText(/100\.00/)).toBeTruthy();

    expect(
      screen.getByText(
        /Development mode uses the Payflow MOCK payment provider/i,
      ),
    ).toBeTruthy();

    const button = screen.getByRole('button', {
      name: 'Add Money',
    });

    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    expect(userAuthenticatedRequest).not.toHaveBeenCalledWith(
      '/payments/orders',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});