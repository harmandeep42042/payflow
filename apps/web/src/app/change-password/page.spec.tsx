import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import ChangePasswordPage from './page';
import { userAuthenticatedRequest } from '../lib/api';

const replace = jest.fn();

const router = {
  replace,
};

jest.mock('next/navigation', () => ({
  useRouter: () => router,
}));

jest.mock('../lib/api', () => ({
  clearUserSession: jest.fn(),
  hasValidUserSession: () => true,
  userAuthenticatedRequest: jest.fn(),
}));

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks mismatched new passwords before the API mutation', async () => {
    render(<ChangePasswordPage />);

    const passwordInputs =
      screen.getAllByLabelText(/password/i);

    expect(passwordInputs.length).toBeGreaterThanOrEqual(3);

    fireEvent.change(passwordInputs[0], {
      target: { value: 'CurrentPass123!' },
    });

    fireEvent.change(passwordInputs[1], {
      target: { value: 'NewPass123!' },
    });

    fireEvent.change(passwordInputs[2], {
      target: { value: 'DifferentPass123!' },
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Change Password',
      }),
    );

    expect(
      await screen.findByText(
        'New password and confirm password do not match',
      ),
    ).toBeTruthy();

    expect(userAuthenticatedRequest).not.toHaveBeenCalledWith(
      '/auth/change-password',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});