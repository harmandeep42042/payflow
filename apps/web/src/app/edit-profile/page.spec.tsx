import {
  render,
  screen,
} from '@testing-library/react';

import EditProfilePage from './page';
import { userAuthenticatedRequest } from '../lib/api';

const replace = jest.fn();

const router = {
  replace,
};

jest.mock('next/navigation', () => ({
  useRouter: () => router,
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

describe('EditProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile editing without submitting an update', () => {
    render(<EditProfilePage />);

    expect(
      screen.getByRole('heading', {
        name: 'Edit Profile',
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole('button', {
        name: /Save/i,
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole('link', {
        name: 'Back to Profile',
      }),
    ).toBeTruthy();

    expect(userAuthenticatedRequest).not.toHaveBeenCalledWith(
      '/auth/profile/update',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});