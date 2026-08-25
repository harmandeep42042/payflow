import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import NotificationsPage from './page';
import { userAuthenticatedRequest } from '../lib/api';

const markNotificationRead = jest.fn();
const removeNotification = jest.fn();
jest.mock('../hooks/use-notifications', () => ({ useNotifications: () => ({ notifications: [{ id: 'notice-1', title: 'Money request received', message: 'A customer requested INR 10.00.', type: 'money.request.created', createdAt: '2026-08-25T10:00:00.000Z', isRead: false }], unreadCount: 1, isConnected: true, markNotificationRead, removeNotification, clearNotifications: jest.fn() }) }));
jest.mock('../lib/api', () => ({ userAuthenticatedRequest: jest.fn().mockResolvedValue({}) }));

describe('NotificationsPage', () => {
  beforeEach(() => jest.clearAllMocks());
  it('uses the existing notification API for mark-read and delete actions', async () => {
    render(<NotificationsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(userAuthenticatedRequest).toHaveBeenCalledWith('/notifications/notice-1/read', { method: 'PATCH' }));
    expect(markNotificationRead).toHaveBeenCalledWith('notice-1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete notification?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(userAuthenticatedRequest).toHaveBeenCalledWith('/notifications/notice-1', { method: 'DELETE' }));
    expect(removeNotification).toHaveBeenCalledWith('notice-1');
  });
});
