import type {
  ReactNode,
} from 'react';

import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import TransactionReceiptPage from './page';

import {
  userAuthenticatedRequest,
} from '../../lib/api';

jest.mock(
  '../../components/customer',
  () => ({
    Card: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => (
      <div className={className}>
        {children}
      </div>
    ),

    ErrorState: ({
      message,
    }: {
      message: string;
    }) => (
      <div role="alert">
        {message}
      </div>
    ),

    LoadingState: () => (
      <div role="status">
        Loading
      </div>
    ),

    PageContainer: ({
      children,
      className,
    }: {
      children: ReactNode;
      className?: string;
    }) => (
      <div className={className}>
        {children}
      </div>
    ),

    PageHeader: ({
      title,
      description,
      actions,
    }: {
      title: string;
      description?: string;
      actions?: ReactNode;
    }) => (
      <header>
        <h1>{title}</h1>

        {description ? (
          <p>{description}</p>
        ) : null}

        {actions}
      </header>
    ),

    StatusBadge: ({
      status,
    }: {
      status: string;
    }) => (
      <span>{status}</span>
    ),
  }),
);

jest.mock(
  '../../lib/api',
  () => ({
    getStoredUser: () => ({
      id: 'user-1',
    }),

    userAuthenticatedRequest:
      jest.fn(),
  }),
);

const TRANSACTION_ID =
  '11111111-1111-4111-8111-111111111111';

describe(
  'TransactionReceiptPage',
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      window.history.replaceState(
        {},
        '',
        `/transactions/receipt?transactionId=${TRANSACTION_ID}`,
      );
    });

    it(
      'renders receipt share and safe repeat navigation',
      async () => {
        jest
          .mocked(
            userAuthenticatedRequest,
          )
          .mockImplementation(
            async (path) => {
              const requestPath =
                String(path);

              if (
                requestPath ===
                '/wallets/user/user-1'
              ) {
                return [
                  {
                    id: 'wallet-1',
                    currency: 'INR',
                    status: 'ACTIVE',
                  },
                ];
              }

              if (
                requestPath.startsWith(
                  '/wallets/wallet-1/transactions?',
                )
              ) {
                return {
                  transactions: [
                    {
                      id:
                        TRANSACTION_ID,
                      type:
                        'TRANSFER',
                      status:
                        'COMPLETED',
                      amount:
                        '125.50',
                      currency:
                        'INR',
                      createdAt:
                        '2026-09-07T10:00:00.000Z',
                      description:
                        'Dinner',
                      sourceWalletId:
                        'wallet-1',
                      destinationWalletId:
                        'wallet-2',
                      counterparty: {
                        firstName:
                          'Asha',
                        lastName:
                          'Sharma',
                        email:
                          'asha@example.test',
                        vpa:
                          'friend@payflow',
                      },
                    },
                  ],
                };
              }

              throw new Error(
                `Unexpected API request: ${requestPath}`,
              );
            },
          );

        render(
          <TransactionReceiptPage />,
        );

        await waitFor(() => {
          expect(
            screen.getByText(
              'INR 125.50',
            ),
          ).toBeTruthy();
        });

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Share receipt',
            },
          ),
        ).toBeTruthy();

        const repeat =
          screen.getByRole(
            'link',
            {
              name:
                'Repeat payment',
            },
          );

        expect(
          repeat.getAttribute(
            'href',
          ),
        ).toBe(
          '/send-money?vpa=friend%40payflow',
        );

        const paymentHelp =
          screen.getByRole(
            'link',
            {
              name:
                'Get help with this payment',
            },
          );

        expect(
          paymentHelp.getAttribute(
            'href',
          ),
        ).toBe(
          `/help?transactionId=${TRANSACTION_ID}`,
        );

        expect(
          screen.getByText(
            /review the recipient, enter the amount/i,
          ),
        ).toBeTruthy();
      },
    );

    it(
      'does not invent repeat recipient from user or wallet ids',
      async () => {
        jest
          .mocked(
            userAuthenticatedRequest,
          )
          .mockImplementation(
            async (path) => {
              const requestPath =
                String(path);

              if (
                requestPath ===
                '/wallets/user/user-1'
              ) {
                return [
                  {
                    id: 'wallet-1',
                    currency: 'INR',
                    status: 'ACTIVE',
                  },
                ];
              }

              return {
                transactions: [
                  {
                    id:
                      TRANSACTION_ID,
                    type:
                      'TRANSFER',
                    status:
                      'COMPLETED',
                    amount:
                      '125.50',
                    currency:
                      'INR',
                    createdAt:
                      '2026-09-07T10:00:00.000Z',
                    sourceWalletId:
                      'wallet-1',
                    destinationWalletId:
                      'wallet-2',
                    counterparty: {
                      userId:
                        'user-2',
                      walletId:
                        'wallet-2',
                    },
                  },
                ],
              };
            },
          );

        render(
          <TransactionReceiptPage />,
        );

        await waitFor(() => {
          expect(
            screen.getByText(
              'INR 125.50',
            ),
          ).toBeTruthy();
        });

        expect(
          screen.queryByRole(
            'link',
            {
              name:
                'Repeat payment',
            },
          ),
        ).toBeNull();
      },
    );

    it(
      'rejects invalid transaction id before API calls',
      async () => {
        window.history.replaceState(
          {},
          '',
          '/transactions/receipt?transactionId=bad',
        );

        render(
          <TransactionReceiptPage />,
        );

        expect(
          await screen.findByText(
            'A valid transaction ID is required to open this receipt.',
          ),
        ).toBeTruthy();

        expect(
          userAuthenticatedRequest,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
