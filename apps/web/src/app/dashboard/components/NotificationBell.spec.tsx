import { fireEvent, render, screen } from '@testing-library/react';

import NotificationBell from './NotificationBell';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../hooks/use-notifications', () => ({
  useNotifications: () => ({
    notifications: [{ id: 'notification-1', userId: 'customer-1', email: null, type: 'payment.completed', title: 'Payment complete', message: 'Your payment completed.', channel: 'IN_APP', status: 'SENT', isRead: false, metadata: null, createdAt: new Date().toISOString(), readAt: null, updatedAt: new Date().toISOString() }],
    unreadCount: 1,
    isConnected: true,
    markNotificationRead: jest.fn(),
    clearNotifications: jest.fn(),
    removeNotification: jest.fn(),
    userId: 'customer-1',
  }),
}));
jest.mock('../../lib/api', () => ({ userAuthenticatedRequest: jest.fn() }));

describe('NotificationBell', () => {
  it('uses separate accessible notification and delete buttons', () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));

    const notification = screen.getByRole('button', { name: /^Payment complete/ });
    const remove = screen.getByRole('button', { name: 'Delete notification: Payment complete' });
    expect(notification.contains(remove)).toBe(false);
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy();
  });
});
