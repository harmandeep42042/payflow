import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import SendMoneyPage from './page';

import {
  userAuthenticatedRequest,
} from '../lib/api';

const replace = jest.fn();
const push = jest.fn();

jest.mock(
  'next/navigation',
  () => ({
    useRouter: () => ({
      replace,
      push,
    }),
  }),
);

jest.mock('../lib/api', () => ({
  API_GATEWAY_URL: 'http://localhost:4000/api/v1',

  getStoredUser: () => ({
    id: 'payer-1',
  }),

  hasValidUserSession: () => true,

  userAuthenticatedRequest:
    jest.fn(),
}));

describe('SendMoneyPage QR payment', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    window.history.replaceState(
      {},
      '',
      '/send-money?qr=1',
    );

    sessionStorage.clear();

    sessionStorage.setItem(
      'payflow:qr-payment-payload',
      'signed-payflow-qr-payload',
    );
  });

  it(
    'loads and verifies the signed QR payload',
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
              requestPath.startsWith(
                '/wallet-qr/verify?',
              )
            ) {
              return {
                vpa:
                  'merchant@payflow',
                currency: 'INR',
                amount: '10.00',
                idempotencyKey:
                  'qr-payment-1',
              };
            }

            if (
              requestPath.startsWith(
                '/wallets/user/',
              )
            ) {
              return [
                {
                  id: 'payer-wallet-1',
                  userId: 'payer-1',
                  balance: '100.00',
                  currency: 'INR',
                  status: 'ACTIVE',
                },
              ];
            }

            if (
              requestPath.startsWith(
                '/wallets/wallet-recipients/resolve',
              )
            ) {
              return {
                recipient: {
                  userId:
                    'merchant-1',
                  email:
                    'merchant@example.test',
                  displayName:
                    'Merchant',
                  walletId:
                    'merchant-wallet-1',
                  currency: 'INR',
                },
              };
            }

            throw new Error(
              `Unexpected API request: ${requestPath}`,
            );
          },
        );

      render(<SendMoneyPage />);

      await waitFor(() => {
        expect(
          userAuthenticatedRequest,
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            '/wallet-qr/verify?payload=',
          ),
        );
      });

      const recipientInput =
        await screen.findByRole(
          'textbox',
          {
            name:
              'Recipient phone, email or payment address',
          },
        );

      expect(
        (recipientInput as HTMLInputElement).value,
      ).toBe(
        'merchant@payflow',
      );

      expect(
        (recipientInput as HTMLInputElement).readOnly,
      ).toBe(true);

      const amountInput =
        screen.getByRole(
          'textbox',
          {
            name: 'Amount',
          },
        );

      expect(
        (amountInput as HTMLInputElement).value,
      ).toBe('10.00');

      expect(
        (amountInput as HTMLInputElement).readOnly,
      ).toBe(true);

      expect(
        sessionStorage.getItem(
          'payflow:qr-payment-payload',
        ),
      ).toBe(
        'signed-payflow-qr-payload',
      );
    },
  );

  it(
    'submits a signed QR through wallet-qr pay and clears the payload',
    async () => {
      jest
        .mocked(
          userAuthenticatedRequest,
        )
        .mockImplementation(
          async (path, options) => {
            const requestPath =
              String(path);

            if (
              requestPath.startsWith(
                '/wallet-qr/verify?',
              )
            ) {
              return {
                vpa:
                  'merchant@payflow',
                currency: 'INR',
                amount: '10.00',
                idempotencyKey:
                  'qr-payment-1',
              };
            }

            if (
              requestPath.startsWith(
                '/wallets/user/',
              )
            ) {
              return [
                {
                  id:
                    'payer-wallet-1',
                  userId:
                    'payer-1',
                  balance:
                    '100.00',
                  currency:
                    'INR',
                  status:
                    'ACTIVE',
                },
              ];
            }

            if (
              requestPath.startsWith(
                '/wallets/wallet-recipients/resolve',
              )
            ) {
              return {
                recipient: {
                  userId:
                    'merchant-1',
                  email:
                    'merchant@example.test',
                  displayName:
                    'Merchant',
                  walletId:
                    'merchant-wallet-1',
                  currency:
                    'INR',
                },
              };
            }

            if (
              requestPath ===
              '/wallet-qr/pay'
            ) {
              expect(
                options?.method,
              ).toBe('POST');

              expect(
                JSON.parse(
                  String(
                    options?.body,
                  ),
                ),
              ).toEqual({
                payload:
                  'signed-payflow-qr-payload',
                description:
                  'QR payment',
              });

              return {
                id:
                  'qr-transfer-1',
                transfer: {
                  id:
                    'qr-transfer-1',
                  status:
                    'COMPLETED',
                  amount:
                    '10.00',
                },
              };
            }

            if (
              requestPath ===
              '/wallets/transfer'
            ) {
              throw new Error(
                'Normal wallet transfer must not be used for QR payment',
              );
            }

            throw new Error(
              `Unexpected API request: ${requestPath}`,
            );
          },
        );

      render(
        <SendMoneyPage />,
      );

      const recipientInput =
        await screen.findByRole(
          'textbox',
          {
            name:
              'Recipient phone, email or payment address',
          },
        );

      await waitFor(() => {
        expect(
          (
            recipientInput as
              HTMLInputElement
          ).value,
        ).toBe(
          'merchant@payflow',
        );
      });

      const verifyButton =
        screen.getByRole(
          'button',
          {
            name:
              /verify/i,
          },
        );

      fireEvent.click(
        verifyButton,
      );

      await waitFor(() => {
        expect(
          userAuthenticatedRequest,
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            '/wallet-recipients/resolve',
          ),
          expect.anything(),
        );
      });

      const reviewButton =
        await screen.findByRole(
          'button',
          {
            name:
              /review.*send money/i,
          },
        );

      fireEvent.click(
        reviewButton,
      );

      const confirmButton =
        await screen.findByRole(
          'button',
          {
            name: /^send money$/i,
          },
        );

      fireEvent.click(
        confirmButton,
      );

      await waitFor(() => {
        expect(
          userAuthenticatedRequest,
        ).toHaveBeenCalledWith(
          '/wallet-qr/pay',
          expect.objectContaining({
            method:
              'POST',
          }),
        );
      });

      expect(
        jest
          .mocked(
            userAuthenticatedRequest,
          )
          .mock.calls.some(
            ([requestPath]) =>
              requestPath ===
              '/wallets/transfer',
          ),
      ).toBe(false);

      await waitFor(() => {
        expect(
          sessionStorage.getItem(
            'payflow:qr-payment-payload',
          ),
        ).toBeNull();
      });

      expect(
        push,
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          '/transfer-success?',
        ),
      );
    },
  );

  it(
    'rejects an invalid or expired signed QR payload',
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
              requestPath.startsWith(
                '/wallet-qr/verify?',
              )
            ) {
              throw new Error(
                'QR is invalid or expired.',
              );
            }

            if (
              requestPath.startsWith(
                '/wallets/user/',
              )
            ) {
              return [
                {
                  id: 'payer-wallet-1',
                  userId: 'payer-1',
                  balance: '100.00',
                  currency: 'INR',
                  status: 'ACTIVE',
                },
              ];
            }

            throw new Error(
              `Unexpected API request: ${requestPath}`,
            );
          },
        );

      render(<SendMoneyPage />);

      expect(
        await screen.findByText(
          'QR is invalid or expired.',
        ),
      ).toBeTruthy();

      expect(
        jest
          .mocked(
            userAuthenticatedRequest,
          )
          .mock.calls.some(
            ([requestPath]) =>
              requestPath ===
              '/wallet-qr/pay',
          ),
      ).toBe(false);
    },
  );

  it(
    'rejects QR mode when the signed payload is missing from the session',
    async () => {
      sessionStorage.removeItem(
        'payflow:qr-payment-payload',
      );

      jest
        .mocked(
          userAuthenticatedRequest,
        )
        .mockImplementation(
          async (path) => {
            const requestPath =
              String(path);

            if (
              requestPath.startsWith(
                '/wallets/user/',
              )
            ) {
              return [
                {
                  id: 'payer-wallet-1',
                  userId: 'payer-1',
                  balance: '100.00',
                  currency: 'INR',
                  status: 'ACTIVE',
                },
              ];
            }

            throw new Error(
              `Unexpected API request: ${requestPath}`,
            );
          },
        );

      render(<SendMoneyPage />);

      expect(
        await screen.findByText(
          'QR payment session is missing. Please scan the QR again.',
        ),
      ).toBeTruthy();

      expect(
        jest
          .mocked(
            userAuthenticatedRequest,
          )
          .mock.calls.some(
            ([requestPath]) =>
              String(
                requestPath,
              ).startsWith(
                '/wallet-qr/verify?',
              ),
          ),
      ).toBe(false);

      expect(
        jest
          .mocked(
            userAuthenticatedRequest,
          )
          .mock.calls.some(
            ([requestPath]) =>
              requestPath ===
              '/wallet-qr/pay',
          ),
      ).toBe(false);
    },
  );
});
describe('SendMoneyPage saved-recipient shortcut', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    window.history.replaceState(
      {},
      '',
      '/send-money?vpa=friend%40payflow',
    );

    sessionStorage.clear();
  });

  it(
    'automatically verifies a VPA supplied by a payment shortcut',
    async () => {
      jest
        .mocked(userAuthenticatedRequest)
        .mockImplementation(async (path) => {
          const requestPath = String(path);

          if (
            requestPath.startsWith(
              '/wallets/user/',
            )
          ) {
            return [
              {
                id: 'payer-wallet-1',
                userId: 'payer-1',
                balance: '100.00',
                currency: 'INR',
                status: 'ACTIVE',
              },
            ];
          }

          if (
            requestPath.startsWith(
              '/wallets/wallet-recipients/resolve?',
            )
          ) {
            return {
              recipient: {
                userId: 'friend-1',
                email: 'friend@example.test',
                displayName: 'Friend Recipient',
                walletId: 'friend-wallet-1',
                currency: 'INR',
              },
            };
          }

          throw new Error(
            `Unexpected API request: ${requestPath}`,
          );
        });

      render(<SendMoneyPage />);

      const recipientInput =
        await screen.findByRole(
          'textbox',
          {
            name:
              'Recipient phone, email or payment address',
          },
        );

      await waitFor(() => {
        expect(
          (
            recipientInput as
              HTMLInputElement
          ).value,
        ).toBe('friend@payflow');
      });

      await waitFor(() => {
        expect(
          userAuthenticatedRequest,
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            '/wallets/wallet-recipients/resolve?',
          ),
          expect.anything(),
        );
      });

      expect(
        jest
          .mocked(userAuthenticatedRequest)
          .mock.calls.some(([path]) =>
            String(path).includes(
              'vpa=friend%40payflow',
            ),
          ),
      ).toBe(true);

      await screen.findByText(
        'Friend Recipient',
      );

      // Shortcut integration ends at recipient verification.
      // It must not initiate a transfer.
      expect(
        jest
          .mocked(userAuthenticatedRequest)
          .mock.calls.some(
            ([path, options]) =>
              String(path) ===
                '/wallets/transfer' &&
              options?.method === 'POST',
          ),
      ).toBe(false);
    },
  );
});
