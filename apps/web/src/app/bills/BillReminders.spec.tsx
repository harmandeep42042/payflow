import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import BillReminders from './BillReminders';

import {
  userAuthenticatedRequest,
} from '../lib/api';

jest.mock(
  '../components/customer',
  () => ({
    Button: ({
      children,
      variant: _variant,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: string;
    }) => (
      <button {...props}>
        {children}
      </button>
    ),

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

    EmptyState: ({
      title,
      description,
    }: {
      title: string;
      description?: string;
    }) => (
      <div>
        <p>{title}</p>

        {description ? (
          <p>{description}</p>
        ) : null}
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

    Field: ({
      id,
      label,
      ...props
    }: InputHTMLAttributes<HTMLInputElement> & {
      id: string;
      label: string;
    }) => (
      <label htmlFor={id}>
        {label}

        <input
          id={id}
          {...props}
        />
      </label>
    ),

    LoadingState: () => (
      <div role="status">
        Loading
      </div>
    ),
  }),
);

jest.mock(
  '../lib/api',
  () => ({
    userAuthenticatedRequest:
      jest.fn(),
  }),
);

const request =
  jest.mocked(
    userAuthenticatedRequest,
  );

const savedBiller = {
  id:
    '11111111-1111-4111-8111-111111111111',
  billerId:
    'provider-biller',
  category:
    'ELECTRICITY',
  customerRef:
    'account-123',
  nickname:
    'Home electricity',
};

const reminder = {
  id:
    '22222222-2222-4222-8222-222222222222',
  savedBillerId:
    savedBiller.id,
  remindAt:
    '2030-01-02T10:30:00.000Z',
  note:
    'Pay after salary',
};

function forbiddenPaymentCalls() {
  return request.mock.calls.filter(
    ([path]) =>
      [
        '/customer-features/bills/validate',
        '/customer-features/bill-payments',
        '/customer-features/recharges',
        '/customer-features/mandates',
      ].includes(
        String(path),
      ),
  );
}

describe(
  'BillReminders',
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it(
      'renders a reminder-only disclosure and empty state',
      async () => {
        request.mockImplementation(
          async (path) => {
            if (
              String(path) ===
              '/customer-features/bill-reminders'
            ) {
              return [];
            }

            if (
              String(path) ===
              '/customer-features/saved-billers'
            ) {
              return [
                savedBiller,
              ];
            }

            throw new Error(
              `Unexpected request: ${String(
                path,
              )}`,
            );
          },
        );

        render(
          <BillReminders />,
        );

        expect(
          await screen.findByText(
            'No bill reminders',
          ),
        ).toBeTruthy();

        expect(
          screen.getByText(
            /do not validate bills, authorize AutoPay, debit your wallet, or submit a payment/i,
          ),
        ).toBeTruthy();

        expect(
          forbiddenPaymentCalls(),
        ).toEqual([]);
      },
    );

    it(
      'creates only a future reminder for a saved biller',
      async () => {
        let reminders:
          typeof reminder[] = [];

        request.mockImplementation(
          async (
            path,
            options,
          ) => {
            const requestPath =
              String(path);

            if (
              requestPath ===
                '/customer-features/bill-reminders' &&
              options?.method ===
                'POST'
            ) {
              const body =
                JSON.parse(
                  String(
                    options.body ??
                      '{}',
                  ),
                ) as Record<
                  string,
                  unknown
                >;

              reminders = [
                {
                  ...reminder,
                  savedBillerId:
                    String(
                      body.savedBillerId,
                    ),
                  remindAt:
                    String(
                      body.remindAt,
                    ),
                  note:
                    String(
                      body.note ??
                        '',
                    ),
                },
              ];

              return reminders[0];
            }

            if (
              requestPath ===
              '/customer-features/bill-reminders'
            ) {
              return reminders;
            }

            if (
              requestPath ===
              '/customer-features/saved-billers'
            ) {
              return [
                savedBiller,
              ];
            }

            throw new Error(
              `Unexpected request: ${requestPath}`,
            );
          },
        );

        render(
          <BillReminders />,
        );

        await screen.findByText(
          'No bill reminders',
        );

        fireEvent.change(
          screen.getByLabelText(
            'Saved biller',
          ),
          {
            target: {
              value:
                savedBiller.id,
            },
          },
        );

        fireEvent.change(
          screen.getByLabelText(
            'Reminder date and time',
          ),
          {
            target: {
              value:
                '2030-01-02T16:00',
            },
          },
        );

        fireEvent.change(
          screen.getByLabelText(
            'Note (optional)',
          ),
          {
            target: {
              value:
                'Pay after salary',
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Save reminder',
            },
          ),
        );

        await waitFor(() => {
          expect(
            request.mock.calls.some(
              ([path, options]) =>
                String(path) ===
                  '/customer-features/bill-reminders' &&
                options?.method ===
                  'POST',
            ),
          ).toBe(true);
        });

        const post =
          request.mock.calls.find(
            ([path, options]) =>
              String(path) ===
                '/customer-features/bill-reminders' &&
              options?.method ===
                'POST',
          );

        expect(post).toBeTruthy();

        if (!post) {
          return;
        }

        const body =
          JSON.parse(
            String(
              post[1]?.body ??
                '{}',
            ),
          ) as Record<
            string,
            unknown
          >;

        expect(
          body.savedBillerId,
        ).toBe(
          savedBiller.id,
        );

        expect(
          typeof body.remindAt,
        ).toBe(
          'string',
        );

        expect(
          body.note,
        ).toBe(
          'Pay after salary',
        );

        expect(
          forbiddenPaymentCalls(),
        ).toEqual([]);
      },
    );

    it(
      'rejects a past reminder before making a POST',
      async () => {
        request.mockImplementation(
          async (path) => {
            if (
              String(path) ===
              '/customer-features/bill-reminders'
            ) {
              return [];
            }

            if (
              String(path) ===
              '/customer-features/saved-billers'
            ) {
              return [
                savedBiller,
              ];
            }

            throw new Error(
              `Unexpected request: ${String(
                path,
              )}`,
            );
          },
        );

        render(
          <BillReminders />,
        );

        await screen.findByText(
          'No bill reminders',
        );

        fireEvent.change(
          screen.getByLabelText(
            'Saved biller',
          ),
          {
            target: {
              value:
                savedBiller.id,
            },
          },
        );

        fireEvent.change(
          screen.getByLabelText(
            'Reminder date and time',
          ),
          {
            target: {
              value:
                '2020-01-01T10:00',
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Save reminder',
            },
          ),
        );

        expect(
          (
            await screen.findByRole(
              'alert',
            )
          ).textContent,
        ).toMatch(
          /must be in the future/i,
        );

        expect(
          request.mock.calls.some(
            ([path, options]) =>
              String(path) ===
                '/customer-features/bill-reminders' &&
              options?.method ===
                'POST',
          ),
        ).toBe(false);

        expect(
          forbiddenPaymentCalls(),
        ).toEqual([]);
      },
    );

    it(
      'renders upcoming reminder with accessible delete action and removes only the reminder',
      async () => {
        let reminders = [
          reminder,
        ];

        request.mockImplementation(
          async (
            path,
            options,
          ) => {
            const requestPath =
              String(path);

            if (
              requestPath ===
                `/customer-features/bill-reminders/${reminder.id}` &&
              options?.method ===
                'DELETE'
            ) {
              reminders = [];
              return reminder;
            }

            if (
              requestPath ===
              '/customer-features/bill-reminders'
            ) {
              return reminders;
            }

            if (
              requestPath ===
              '/customer-features/saved-billers'
            ) {
              return [
                savedBiller,
              ];
            }

            throw new Error(
              `Unexpected request: ${requestPath}`,
            );
          },
        );

        render(
          <BillReminders />,
        );

        expect(
          await screen.findByText(
            'Home electricity',
          ),
        ).toBeTruthy();

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Delete reminder for Home electricity',
            },
          ),
        ).toBeTruthy();

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Delete reminder for Home electricity',
            },
          ),
        );

        await waitFor(() => {
          expect(
            request,
          ).toHaveBeenCalledWith(
            `/customer-features/bill-reminders/${reminder.id}`,
            {
              method:
                'DELETE',
            },
          );
        });

        expect(
          forbiddenPaymentCalls(),
        ).toEqual([]);
      },
    );

    it(
      'disables reminder creation when no saved biller exists',
      async () => {
        request.mockImplementation(
          async (path) => {
            if (
              String(path) ===
              '/customer-features/bill-reminders'
            ) {
              return [];
            }

            if (
              String(path) ===
              '/customer-features/saved-billers'
            ) {
              return [];
            }

            throw new Error(
              `Unexpected request: ${String(
                path,
              )}`,
            );
          },
        );

        render(
          <BillReminders />,
        );

        expect(
          await screen.findByText(
            /Save a biller reference first/i,
          ),
        ).toBeTruthy();

        expect(
          (
            screen.getByRole(
              'button',
              {
                name:
                  'Save reminder',
              },
            ) as HTMLButtonElement
          ).disabled,
        ).toBe(true);

        expect(
          forbiddenPaymentCalls(),
        ).toEqual([]);
      },
    );
  },
);
