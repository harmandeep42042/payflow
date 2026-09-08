import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import HelpPage from './page';

import {
  userAuthenticatedRequest,
} from '../lib/api';

jest.mock(
  '../components/customer',
  () => ({
    Button: ({
      children,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement>) => (
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
    }: {
      title: string;
      description?: string;
    }) => (
      <header>
        <h1>{title}</h1>
        {description ? (
          <p>{description}</p>
        ) : null}
      </header>
    ),

    SelectField: ({
      id,
      label,
      children,
      ...props
    }: SelectHTMLAttributes<HTMLSelectElement> & {
      id: string;
      label: string;
      children: ReactNode;
    }) => (
      <label htmlFor={id}>
        {label}
        <select
          id={id}
          {...props}
        >
          {children}
        </select>
      </label>
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

const TRANSACTION_ID =
  '11111111-1111-4111-8111-111111111111';

describe(
  'Help payment transaction prefill',
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      window.history.replaceState(
        {},
        '',
        '/help',
      );

      jest
        .mocked(
          userAuthenticatedRequest,
        )
        .mockImplementation(
          async (
            path,
            options,
          ) => {
            const requestPath =
              String(path);

            if (
              requestPath ===
                '/customer-features/support-cases' &&
              !options
            ) {
              return [];
            }

            if (
              requestPath ===
                '/customer-features/support-cases' &&
              options
            ) {
              throw new Error(
                'Unexpected automatic support-case mutation',
              );
            }

            throw new Error(
              `Unexpected API request: ${requestPath}`,
            );
          },
        );
    });

    it(
      'prefills a valid receipt transaction without creating a case',
      async () => {
        window.history.replaceState(
          {},
          '',
          `/help?transactionId=${TRANSACTION_ID}`,
        );

        render(
          <HelpPage />,
        );

        const transactionField =
          screen.getByLabelText(
            'Transaction ID (optional)',
          ) as HTMLInputElement;

        await waitFor(() => {
          expect(
            transactionField.value,
          ).toBe(
            TRANSACTION_ID,
          );
        });

        expect(
          screen.getByRole(
            'button',
            {
              name:
                'Create case',
            },
          ),
        ).toBeTruthy();

        expect(
          screen.getByText(
            /never creates a support case automatically/i,
          ),
        ).toBeTruthy();

        expect(
          userAuthenticatedRequest,
        ).toHaveBeenCalledWith(
          '/customer-features/support-cases',
        );

        expect(
          userAuthenticatedRequest,
        ).not.toHaveBeenCalledWith(
          '/customer-features/support-cases',
          expect.objectContaining({
            method: 'POST',
          }),
        );
      },
    );

    it(
      'ignores an invalid payment-help transaction id',
      async () => {
        window.history.replaceState(
          {},
          '',
          '/help?transactionId=not-a-valid-uuid',
        );

        render(
          <HelpPage />,
        );

        const transactionField =
          screen.getByLabelText(
            'Transaction ID (optional)',
          ) as HTMLInputElement;

        await waitFor(() => {
          expect(
            transactionField.value,
          ).toBe('');
        });

        expect(
          userAuthenticatedRequest,
        ).not.toHaveBeenCalledWith(
          '/customer-features/support-cases',
          expect.objectContaining({
            method: 'POST',
          }),
        );
      },
    );

    it(
      'keeps the prefilled transaction editable',
      async () => {
        window.history.replaceState(
          {},
          '',
          `/help?transactionId=${TRANSACTION_ID}`,
        );

        render(
          <HelpPage />,
        );

        const transactionField =
          screen.getByLabelText(
            'Transaction ID (optional)',
          ) as HTMLInputElement;

        await waitFor(() => {
          expect(
            transactionField.value,
          ).toBe(
            TRANSACTION_ID,
          );
        });

        expect(
          transactionField.disabled,
        ).toBe(false);

        expect(
          transactionField.readOnly,
        ).toBe(false);
      },
    );
  },
);
