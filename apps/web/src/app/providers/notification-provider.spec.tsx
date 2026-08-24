import { render, waitFor } from '@testing-library/react';

import { NotificationProvider } from './notification-provider';
import { getUserAccessToken } from '../lib/api';
import { io } from 'socket.io-client';

jest.mock('../lib/api', () => ({
  API_GATEWAY_URL: 'http://localhost:4000/api/v1',
  getUserAccessToken: jest.fn(),
  userAuthenticatedRequest: jest.fn().mockResolvedValue({ notifications: [] }),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

describe('NotificationProvider realtime connection', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    (getUserAccessToken as jest.Mock).mockReturnValue('customer.jwt.token');
  });

  it('connects a logged-in Customer using the canonical in-memory access token', async () => {
    const token = 'customer.jwt.token';

    localStorage.setItem(
      'payflow_user_profile',
      JSON.stringify({ id: 'customer-123', role: 'USER' }),
    );
    render(
      <NotificationProvider>
        <div>Customer app</div>
      </NotificationProvider>,
    );

    await waitFor(() => expect(io).toHaveBeenCalledTimes(1));

    expect(io).toHaveBeenCalledWith(
      'http://localhost:4000/notifications',
      expect.objectContaining({
        auth: expect.any(Function),
      }),
    );

    const options = (io as jest.Mock).mock.calls[0][1];
    const callback = jest.fn();
    options.auth(callback);

    expect(callback).toHaveBeenCalledWith({ token });
  });

  it('stops reconnecting when the Socket.IO server rejects authentication', async () => {
    localStorage.setItem(
      'payflow_user_profile',
      JSON.stringify({ id: 'customer-123', role: 'USER' }),
    );
    render(
      <NotificationProvider>
        <div>Customer app</div>
      </NotificationProvider>,
    );

    await waitFor(() => expect(io).toHaveBeenCalledTimes(1));

    const socket = (io as jest.Mock).mock.results[0].value;
    const connectErrorHandler = socket.on.mock.calls.find(
      ([eventName]: [string]) => eventName === 'connect_error',
    )?.[1];

    expect(connectErrorHandler).toEqual(expect.any(Function));
    connectErrorHandler(new Error('Invalid or expired access token'));
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });
});
