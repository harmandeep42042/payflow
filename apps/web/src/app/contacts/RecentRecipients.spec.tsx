import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import RecentRecipients from './RecentRecipients';

import {
  userAuthenticatedRequest,
} from '../lib/api';

jest.mock('../lib/api', () => ({
  getStoredUser: () => ({
    id: 'payer-1',
  }),

  userAuthenticatedRequest:
    jest.fn(),
}));

describe('RecentRecipients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(
    'derives recent saved recipients from completed outgoing wallet history',
    async () => {
      jest
        .mocked(userAuthenticatedRequest)
        .mockImplementation(async (path) => {
          const requestPath = String(path);

          if (
            requestPath ===
            '/customer-features/contacts'
          ) {
            return [
              {
                id: 'contact-alex',
                nickname: 'Alex',
                favourite: true,
                recipient: {
                  id: 'alex-user',
                  firstName: 'Alexander',
                  lastName: 'Payflow',
                  vpa: 'alex@payflow',
                },
              },
              {
                id: 'contact-bea',
                nickname: null,
                favourite: false,
                recipient: {
                  id: 'bea-user',
                  firstName: 'Bea',
                  lastName: 'Tester',
                  vpa: 'bea@payflow',
                },
              },
            ];
          }

          if (
            requestPath ===
            '/wallets/user/payer-1'
          ) {
            return [
              {
                id: 'payer-wallet',
                userId: 'payer-1',
                currency: 'INR',
                status: 'ACTIVE',
              },
            ];
          }

          if (
            requestPath.startsWith(
              '/wallets/payer-wallet/transactions?',
            )
          ) {
            return {
              transactions: [
                {
                  id: 'transfer-newest',
                  status: 'COMPLETED',
                  createdAt:
                    '2026-09-07T08:00:00.000Z',
                  sourceWalletId:
                    'payer-wallet',
                  destinationWalletId:
                    'alex-wallet',
                  counterparty: {
                    walletId: 'alex-wallet',
                    userId: 'alex-user',
                    firstName: 'Alexander',
                    lastName: 'Payflow',
                    email:
                      'alex@example.test',
                  },
                },
                {
                  id: 'transfer-duplicate',
                  status: 'COMPLETED',
                  createdAt:
                    '2026-09-06T08:00:00.000Z',
                  sourceWalletId:
                    'payer-wallet',
                  destinationWalletId:
                    'alex-wallet',
                  counterparty: {
                    walletId: 'alex-wallet',
                    userId: 'alex-user',
                    firstName: 'Alexander',
                    lastName: 'Payflow',
                    email:
                      'alex@example.test',
                  },
                },
                {
                  id: 'transfer-bea',
                  status: 'COMPLETED',
                  createdAt:
                    '2026-09-05T08:00:00.000Z',
                  sourceWalletId:
                    'payer-wallet',
                  destinationWalletId:
                    'bea-wallet',
                  counterparty: {
                    walletId: 'bea-wallet',
                    userId: 'bea-user',
                    firstName: 'Bea',
                    lastName: 'Tester',
                    email:
                      'bea@example.test',
                  },
                },
                {
                  id: 'incoming-transfer',
                  status: 'COMPLETED',
                  createdAt:
                    '2026-09-07T09:00:00.000Z',
                  sourceWalletId:
                    'someone-else-wallet',
                  destinationWalletId:
                    'payer-wallet',
                  counterparty: {
                    walletId:
                      'someone-else-wallet',
                    userId:
                      'someone-else',
                    firstName: 'Incoming',
                    lastName: 'Person',
                    email:
                      'incoming@example.test',
                  },
                },
              ],
            };
          }

          throw new Error(
            `Unexpected request: ${requestPath}`,
          );
        });

      render(<RecentRecipients />);

      const alexLink =
        await screen.findByRole(
          'link',
          {
            name: 'Pay Alex',
          },
        );

      expect(
        alexLink.getAttribute('href'),
      ).toBe(
        '/send-money?vpa=alex%40payflow',
      );

      const beaLink =
        screen.getByRole(
          'link',
          {
            name: 'Pay Bea Tester',
          },
        );

      expect(
        beaLink.getAttribute('href'),
      ).toBe(
        '/send-money?vpa=bea%40payflow',
      );

      expect(
        screen.queryByText('Incoming Person'),
      ).toBeNull();

      await waitFor(() => {
        expect(
          userAuthenticatedRequest,
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            '/wallets/payer-wallet/transactions?',
          ),
        );
      });

      expect(
        screen.getAllByText('alex@payflow'),
      ).toHaveLength(1);
    },
  );
});
describe('RecentRecipients UX states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(
    'keeps history failure separate from a genuine empty state',
    async () => {
      jest
        .mocked(userAuthenticatedRequest)
        .mockImplementation(async (path) => {
          const requestPath = String(path);

          if (
            requestPath ===
            '/customer-features/contacts'
          ) {
            return [
              {
                id: 'contact-1',
                nickname: 'Saved friend',
                favourite: true,
                recipient: {
                  id: 'friend-1',
                  firstName: 'Saved',
                  lastName: 'Friend',
                  vpa: 'friend@payflow',
                },
              },
            ];
          }

          if (
            requestPath ===
            '/wallets/user/payer-1'
          ) {
            return [
              {
                id: 'payer-wallet',
                userId: 'payer-1',
                currency: 'INR',
                status: 'ACTIVE',
              },
            ];
          }

          if (
            requestPath.startsWith(
              '/wallets/payer-wallet/transactions?',
            )
          ) {
            throw new Error(
              'History unavailable',
            );
          }

          throw new Error(
            `Unexpected request: ${requestPath}`,
          );
        });

      render(<RecentRecipients />);

      await screen.findByText(
        'Recent recipients unavailable',
      );

      expect(
        screen.queryByText(
          'No recent saved recipients yet',
        ),
      ).toBeNull();
    },
  );
});