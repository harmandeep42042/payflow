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

import SavedBillers from './SavedBillers';

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

type SavedBillerFixture = {
  id: string;
  billerId: string;
  category: string;
  customerRef: string;
  nickname?: string | null;
};

const savedFixture:
  SavedBillerFixture = {
    id:
      '11111111-1111-4111-8111-111111111111',
    billerId:
      'provider-biller-1',
    category:
      'ELECTRICITY',
    customerRef:
      'account-123',
    nickname:
      'Home electricity',
  };

function paymentFields(
  billerId =
    'provider-biller-1',
) {
  return (
    <form aria-label="Bill payment fields">
      <label htmlFor="bill-category">
        Category
        <select
          id="bill-category"
          name="category"
          defaultValue="WATER"
        >
          <option value="WATER">
            Water
          </option>
          <option value="ELECTRICITY">
            Electricity
          </option>
        </select>
      </label>

      <label htmlFor="bill-biller">
        Biller
        <select
          id="bill-biller"
          name="billerId"
          defaultValue={billerId}
        >
          <option value={billerId}>
            Provider Biller
          </option>
        </select>
      </label>

      <label htmlFor="bill-account">
        Account
        <input
          id="bill-account"
          name="customerRef"
          defaultValue="account-123"
        />
      </label>
    </form>
  );
}

function mutationCalls() {
  return request.mock.calls.filter(
    ([path, options]) =>
      options?.method &&
      String(path) !==
        '/customer-features/saved-billers',
  );
}

describe(
  'SavedBillers',
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it(
      'saves only the current provider-returned biller reference without validating or paying',
      async () => {
        let saved:
          SavedBillerFixture[] = [];

        request.mockImplementation(
          async (
            path,
            options,
          ) => {
            const requestPath =
              String(path);

            if (
              requestPath ===
                '/customer-features/saved-billers' &&
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

              saved = [
                {
                  ...savedFixture,
                  billerId:
                    String(
                      body.billerId,
                    ),
                  category:
                    String(
                      body.category,
                    ),
                  customerRef:
                    String(
                      body.customerRef,
                    ),
                  nickname:
                    String(
                      body.nickname ??
                        '',
                    ) ||
                    null,
                },
              ];

              return saved[0];
            }

            if (
              requestPath ===
              '/customer-features/saved-billers'
            ) {
              return saved;
            }

            throw new Error(
              `Unexpected request: ${requestPath}`,
            );
          },
        );

        render(
          <>
            {paymentFields()}
            <SavedBillers />
          </>,
        );

        await screen.findByText(
          'No saved billers',
        );

        fireEvent.change(
          screen.getByLabelText(
            'Nickname (optional)',
          ),
          {
            target: {
              value:
                'Home electricity',
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Save current reference',
            },
          ),
        );

        await waitFor(() => {
          expect(
            request.mock.calls.some(
              ([path, options]) =>
                String(path) ===
                  '/customer-features/saved-billers' &&
                options?.method ===
                  'POST',
            ),
          ).toBe(true);
        });

        const post =
          request.mock.calls.find(
            ([path, options]) =>
              String(path) ===
                '/customer-features/saved-billers' &&
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

        expect(body).toEqual({
          billerId:
            'provider-biller-1',
          category:
            'WATER',
          customerRef:
            'account-123',
          nickname:
            'Home electricity',
        });

        expect(
          request.mock.calls.some(
            ([path]) =>
              String(path) ===
              '/customer-features/bills/validate',
          ),
        ).toBe(false);

        expect(
          request.mock.calls.some(
            ([path]) =>
              String(path) ===
              '/customer-features/bill-payments',
          ),
        ).toBe(false);

        expect(
          mutationCalls(),
        ).toEqual([]);
      },
    );

    it(
      'fills a saved reference only when that biller is currently returned by the provider',
      async () => {
        request.mockResolvedValue(
          [savedFixture],
        );

        render(
          <>
            {paymentFields()}
            <SavedBillers />
          </>,
        );

        await screen.findByText(
          'Home electricity',
        );

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Use Home electricity',
            },
          ),
        );

        expect(
          (
            document.getElementById(
              'bill-category',
            ) as HTMLSelectElement
          ).value,
        ).toBe(
          'ELECTRICITY',
        );

        expect(
          (
            document.getElementById(
              'bill-biller',
            ) as HTMLSelectElement
          ).value,
        ).toBe(
          'provider-biller-1',
        );

        expect(
          (
            document.getElementById(
              'bill-account',
            ) as HTMLInputElement
          ).value,
        ).toBe(
          'account-123',
        );

        expect(
          screen.getByText(
            /Validate and review the current provider bill/i,
          ),
        ).toBeTruthy();

        expect(
          request.mock.calls.some(
            ([path]) =>
              String(path) ===
                '/customer-features/bills/validate' ||
              String(path) ===
                '/customer-features/bill-payments',
          ),
        ).toBe(false);
      },
    );

    it(
      'refuses to use a stale saved biller when the provider no longer returns it',
      async () => {
        request.mockResolvedValue(
          [savedFixture],
        );

        render(
          <>
            {paymentFields(
              'different-provider-biller',
            )}
            <SavedBillers />
          </>,
        );

        await screen.findByText(
          'Home electricity',
        );

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Use Home electricity',
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
          /not currently returned by the provider/i,
        );

        expect(
          request.mock.calls.some(
            ([path]) =>
              String(path) ===
                '/customer-features/bills/validate' ||
              String(path) ===
                '/customer-features/bill-payments',
          ),
        ).toBe(false);
      },
    );

    it(
      'deletes only the saved reference',
      async () => {
        let items = [
          savedFixture,
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
                `/customer-features/saved-billers/${savedFixture.id}` &&
              options?.method ===
                'DELETE'
            ) {
              items = [];
              return savedFixture;
            }

            if (
              requestPath ===
              '/customer-features/saved-billers'
            ) {
              return items;
            }

            throw new Error(
              `Unexpected request: ${requestPath}`,
            );
          },
        );

        render(
          <SavedBillers />,
        );

        await screen.findByText(
          'Home electricity',
        );

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Delete Home electricity',
            },
          ),
        );

        await waitFor(() => {
          expect(
            request,
          ).toHaveBeenCalledWith(
            `/customer-features/saved-billers/${savedFixture.id}`,
            {
              method: 'DELETE',
            },
          );
        });

        expect(
          request.mock.calls.some(
            ([path]) =>
              String(path) ===
                '/customer-features/bills/validate' ||
              String(path) ===
                '/customer-features/bill-payments',
          ),
        ).toBe(false);
      },
    );
  },
);
