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

import RechargePage from './page';

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

    ConfirmationDialog: ({
      open,
      title,
      description,
      confirmLabel,
      isLoading,
      onConfirm,
      onClose,
    }: {
      open: boolean;
      title: string;
      description: string;
      confirmLabel: string;
      isLoading?: boolean;
      onConfirm: () => void;
      onClose: () => void;
    }) =>
      open ? (
        <div
          role="dialog"
          aria-label={title}
        >
          <p>{description}</p>

          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>

          <button
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      ) : null,

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
      hint: _hint,
      ...props
    }: InputHTMLAttributes<HTMLInputElement> & {
      id: string;
      label: string;
      hint?: string;
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

function countRechargePosts() {
  return request.mock.calls.filter(
    ([path, options]) =>
      String(path) ===
        '/customer-features/recharges' &&
      options?.method === 'POST',
  ).length;
}

function providerNotConfiguredMock() {
  request.mockImplementation(
    async (
      path,
      options,
    ) => {
      const requestPath =
        String(path);

      if (
        requestPath ===
          '/customer-features/recharges' &&
        options?.method === 'POST'
      ) {
        return {
          id:
            '11111111-1111-4111-8111-111111111111',
          operator:
            'Operator A',
          mobileNumber:
            '+919876543210',
          amount:
            '249.00',
          currency:
            'INR',
          status:
            'PROVIDER_NOT_CONFIGURED',
          failureCode:
            'PROVIDER_NOT_CONFIGURED',
          code:
            'PROVIDER_NOT_CONFIGURED',
          message:
            'Recharge provider is not configured.',
          createdAt:
            '2026-09-08T04:00:00.000Z',
        };
      }

      if (
        requestPath ===
        '/customer-features/recharges'
      ) {
        return [];
      }

      if (
        requestPath ===
        '/customer-features/recharges/plans'
      ) {
        return {
          code:
            'PROVIDER_NOT_CONFIGURED',
          plans: [],
        };
      }

      throw new Error(
        `Unexpected API request: ${requestPath}`,
      );
    },
  );
}

describe(
  'RechargePage',
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      providerNotConfiguredMock();
    });

    it(
      'shows provider-unconfigured state without fabricating plans',
      async () => {
        render(
          <RechargePage />,
        );

        expect(
          await screen.findByText(
            /PROVIDER_NOT_CONFIGURED — Recharge provider is not configured/i,
          ),
        ).toBeTruthy();

        expect(
          screen.getByText(
            'No provider plans are available.',
          ),
        ).toBeTruthy();

        expect(
          screen.queryByLabelText(
            'Provider plan',
          ),
        ).toBeNull();

        expect(
          countRechargePosts(),
        ).toBe(0);
      },
    );

    it(
      'requires review and explicit confirmation before POSTing a recharge attempt',
      async () => {
        render(
          <RechargePage />,
        );

        await screen.findByText(
          /PROVIDER_NOT_CONFIGURED — Recharge provider is not configured/i,
        );

        fireEvent.change(
          screen.getByLabelText(
            'Mobile number',
          ),
          {
            target: {
              value:
                '+919876543210',
            },
          },
        );

        fireEvent.change(
          screen.getByLabelText(
            'Operator',
          ),
          {
            target: {
              value:
                'Operator A',
            },
          },
        );

        fireEvent.change(
          screen.getByLabelText(
            'Amount',
          ),
          {
            target: {
              value:
                '249.00',
            },
          },
        );

        const currency =
          screen.getByLabelText(
            'Currency',
          ) as HTMLInputElement;

        expect(
          currency.value,
        ).toBe('INR');

        const reviewButton =
          screen.getByRole(
            'button',
            {
              name:
                'Review attempt',
            },
          );

        const form =
          reviewButton.closest(
            'form',
          );

        expect(form).toBeTruthy();

        if (!form) {
          return;
        }

        fireEvent.submit(form);

        const dialog =
          await screen.findByRole(
            'dialog',
            {
              name:
                'Confirm recharge attempt',
            },
          );

        expect(dialog).toBeTruthy();

        expect(
          screen.getByText(
            /This does not guarantee success/i,
          ),
        ).toBeTruthy();

        expect(
          countRechargePosts(),
        ).toBe(0);

        fireEvent.click(
          screen.getByRole(
            'button',
            {
              name:
                'Submit attempt',
            },
          ),
        );

        await waitFor(() => {
          expect(
            countRechargePosts(),
          ).toBe(1);
        });

        const postCall =
          request.mock.calls.find(
            ([path, options]) =>
              String(path) ===
                '/customer-features/recharges' &&
              options?.method ===
                'POST',
          );

        expect(
          postCall,
        ).toBeTruthy();

        if (!postCall) {
          return;
        }

        const options =
          postCall[1];

        const body =
          JSON.parse(
            String(
              options?.body ??
                '{}',
            ),
          ) as Record<
            string,
            unknown
          >;

        expect(
          body.mobileNumber,
        ).toBe(
          '+919876543210',
        );

        expect(
          body.operator,
        ).toBe(
          'Operator A',
        );

        expect(
          body.amount,
        ).toBe(
          '249.00',
        );

        expect(
          body.currency,
        ).toBe(
          'INR',
        );

        expect(
          typeof body.idempotencyKey,
        ).toBe(
          'string',
        );

        expect(
          String(
            body.idempotencyKey ??
              '',
          ).length,
        ).toBeGreaterThan(0);
      },
    );

    it(
      'uses provider-returned plans only when plans are actually returned',
      async () => {
        request.mockImplementation(
          async (
            path,
            options,
          ) => {
            const requestPath =
              String(path);

            if (
              requestPath ===
                '/customer-features/recharges' &&
              !options
            ) {
              return [];
            }

            if (
              requestPath ===
                '/customer-features/recharges/plans'
            ) {
              return {
                code:
                  'CONFIGURED',
                plans: [
                  {
                    id:
                      'provider-plan-1',
                    name:
                      'Provider Plan 249',
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
          <RechargePage />,
        );

        const plan =
          await screen.findByLabelText(
            'Provider plan',
          ) as HTMLSelectElement;

        expect(
          plan.options,
        ).toHaveLength(1);

        expect(
          plan.options[0]
            .value,
        ).toBe(
          'provider-plan-1',
        );

        expect(
          plan.options[0]
            .textContent,
        ).toBe(
          'Provider Plan 249',
        );

        expect(
          countRechargePosts(),
        ).toBe(0);
      },
    );
  },
);
