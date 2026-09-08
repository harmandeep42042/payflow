import { render, screen, waitFor } from '@testing-library/react';

import TransferPage from './page';
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

describe('TransferPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(userAuthenticatedRequest).mockImplementation(
      async (path) => {
        const requestPath = String(path);

        if (requestPath.startsWith('/wallets/user/')) {
          return [{
            id: 'wallet-1',
            userId: 'customer-1',
            balance: '250.00',
            currency: 'INR',
            status: 'ACTIVE',
          }];
        }

        throw new Error(`Unexpected API request: ${requestPath}`);
      },
    );
  });

  it('loads the wallet and keeps transfer action available without submitting money', async () => {
    render(<TransferPage />);

    expect(await screen.findByText(/250\.00/)).toBeTruthy();

    expect(
      screen.getByRole('textbox', {
        name: 'Receiver Wallet ID',
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole('spinbutton', {
        name: 'Amount',
      }),
    ).toBeTruthy();

    const button = screen.getByRole('button', {
      name: 'Send Money',
    });

    await waitFor(() => {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    expect(userAuthenticatedRequest).not.toHaveBeenCalledWith(
      expect.stringContaining('/transfer'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});