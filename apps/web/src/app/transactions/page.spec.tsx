import { render, screen } from '@testing-library/react';

import TransactionsPage from './page';
import { userAuthenticatedRequest } from '../lib/api';

jest.mock('../components/customer', () => ({
  PageContainer: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,

  LoadingState: ({
    label,
  }: {
    label?: string;
  }) => <div>{label ?? 'Loading'}</div>,

  ErrorState: ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry?: () => void;
  }) => (
    <div>
      <div>{message}</div>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
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
      <div>{title}</div>
      {description ? <div>{description}</div> : null}
    </div>
  ),

  StatusBadge: ({
    status,
  }: {
    status: string;
  }) => <span>{status}</span>,
}));

jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('../lib/api', () => ({
  getStoredUser: () => ({ id: 'customer-1' }),
  hasValidUserSession: () => true,
  userAuthenticatedRequest: jest.fn(),
}));

jest.mock('./TransactionChart', () => ({
  __esModule: true,
  default: () => <div data-testid="transaction-chart" />,
}));

describe('TransactionsPage', () => {
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

        if (requestPath.includes('/transactions')) {
          return {
            items: [],
          };
        }

        throw new Error(`Unexpected API request: ${requestPath}`);
      },
    );
  });

  it('renders the transaction history empty state safely', async () => {
    render(<TransactionsPage />);

    expect(
      await screen.findByText('No transactions found'),
    ).toBeTruthy();

    expect(
      screen.getByPlaceholderText('Search transactions...'),
    ).toBeTruthy();

    expect(
      screen.getByRole('heading', {
        name: 'Transaction History',
      }),
    ).toBeTruthy();
  });
});