import {
  render,
  screen,
} from '@testing-library/react';

import NotificationSettingsPage from './page';
import { userAuthenticatedRequest } from '../lib/api';

jest.mock('../lib/api', () => ({
  userAuthenticatedRequest: jest.fn(),
}));

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    window.localStorage.setItem(
      'payflow_user_profile',
      JSON.stringify({
        id: 'customer-1',
      }),
    );

    jest.mocked(userAuthenticatedRequest).mockResolvedValue({
      id: 'preference-1',
      userId: 'customer-1',
      inAppEnabled: true,
      emailEnabled: true,
      transfersEnabled: true,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      paymentsEnabled: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('loads notification preferences without mutating them', async () => {
    render(<NotificationSettingsPage />);

    expect(
      await screen.findByText('In-app notifications'),
    ).toBeTruthy();

    expect(
      screen.getByText('Email notifications'),
    ).toBeTruthy();

    expect(userAuthenticatedRequest).toHaveBeenCalledWith(
      '/notification-preferences',
      {
        method: 'GET',
        cache: 'no-store',
      },
    );

    expect(userAuthenticatedRequest).not.toHaveBeenCalledWith(
      '/notification-preferences',
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
  });
});