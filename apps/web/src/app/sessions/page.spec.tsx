import {
  render,
  screen,
} from '@testing-library/react';

import SessionsPage from './page';
import {
  customerSessionRequest,
  userAuthenticatedRequest,
} from '../lib/api';

const replace = jest.fn();

const router = {
  replace,
};

jest.mock('next/navigation', () => ({
  useRouter: () => router,
}));

jest.mock('../lib/api', () => ({
  clearUserSession: jest.fn(),
  customerSessionRequest: jest.fn(),
  userAuthenticatedRequest: jest.fn(),
}));

jest.mock('../components/customer', () => ({
  PageContainer: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,

  PageHeader: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  ),

  ErrorState: ({
    message,
  }: {
    message: string;
  }) => <div>{message}</div>,
}));

describe('SessionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(userAuthenticatedRequest).mockResolvedValue({
      sessions: [],
      total: 0,
    });

    jest.mocked(customerSessionRequest).mockResolvedValue({
      sessionId: 'session-current',
    });
  });

  it('loads sessions and safely renders an empty state', async () => {
    render(<SessionsPage />);

    expect(
      await screen.findByText('No active sessions found.'),
    ).toBeTruthy();

    expect(userAuthenticatedRequest).toHaveBeenCalledWith(
      '/auth/sessions',
    );

    expect(customerSessionRequest).toHaveBeenCalledWith(
      '/sessions/current',
      {
        method: 'POST',
      },
    );

    expect(
      screen.getByRole('heading', {
        name: 'Active sessions',
      }),
    ).toBeTruthy();
  });
});