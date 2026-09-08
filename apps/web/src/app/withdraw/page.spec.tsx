import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import WithdrawPage from './page';
import { userAuthenticatedRequest } from '../lib/api';

const replace = jest.fn();

const router = {
  replace,
};

jest.mock('next/navigation', () => ({
  useRouter: () => router,
}));

jest.mock('../lib/api', () => ({
  getStoredUser: () => ({ id: 'customer-1' }),
  hasValidUserSession: () => true,
  userAuthenticatedRequest: jest.fn(),
}));

describe('WithdrawPage', () => {
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

  it('blocks withdrawal above available balance before any POST request', async () => {
    render(<WithdrawPage />);

    expect(await screen.findByText(/100\.00/)).toBeTruthy();

    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: 'Amount',
      }),
      {
        target: {
          value: '101',
        },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Withdraw Money',
      }),
    );

    expect(
      await screen.findByText('Insufficient wallet balance'),
    ).toBeTruthy();

    await waitFor(() => {
      expect(userAuthenticatedRequest).not.toHaveBeenCalledWith(
        '/wallets/withdraw',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});