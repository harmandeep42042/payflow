import { render, screen } from '@testing-library/react';

import ProfilePage from './page';
import { userAuthenticatedRequest } from '../lib/api';

const replace = jest.fn();

const router = {
  replace,
};

jest.mock('next/navigation', () => ({
  useRouter: () => router,
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
    actions,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
    </header>
  ),

  LoadingState: ({
    label,
  }: {
    label?: string;
  }) => <div>{label ?? 'Loading'}</div>,

  ErrorState: ({
    message,
  }: {
    message: string;
  }) => <div>{message}</div>,

  Avatar: ({
    name,
  }: {
    name?: string;
  }) => <div aria-label="avatar">{name ?? 'User'}</div>,

  StatusBadge: ({
    status,
  }: {
    status: string;
  }) => <span>{status}</span>,
}));

jest.mock('../lib/api', () => ({
  getStoredUser: () => ({
    id: 'customer-1',
    email: 'customer@payflow.test',
    firstName: 'Test',
    lastName: 'Customer',
  }),
  hasValidUserSession: () => true,
  userAuthenticatedRequest: jest.fn(),
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(userAuthenticatedRequest).mockResolvedValue({
      user: {
        id: 'customer-1',
        email: 'customer@payflow.test',
        firstName: 'Test',
        lastName: 'Customer',
        phone: null,
        status: 'ACTIVE',
        role: 'USER',
      },
    });
  });

  it('loads the authenticated profile and exposes account settings', async () => {
    render(<ProfilePage />);

    expect(
      await screen.findByText('Profile and settings'),
    ).toBeTruthy();

    expect(
      screen.getByRole('link', {
        name: 'Edit Profile',
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole('link', {
        name: 'Change Password',
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole('link', {
        name: 'Notification Settings',
      }),
    ).toBeTruthy();

    expect(userAuthenticatedRequest).toHaveBeenCalledWith(
      '/auth/profile',
    );
  });
});