'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  RealtimeNotification,
} from '../../providers/notification-provider';

import {
  useNotifications,
} from '../../hooks/use-notifications';

import {
  userAuthenticatedRequest,
} from '../../lib/api';

function formatRelativeTime(
  dateValue: string,
): string {
  const date =
    new Date(dateValue);

  const differenceInSeconds =
    Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          date.getTime()
        ) / 1000,
      ),
    );

  if (differenceInSeconds < 60) {
    return 'Just now';
  }

  const minutes =
    Math.floor(
      differenceInSeconds / 60,
    );

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  if (days < 7) {
    return `${days} day${
      days === 1
        ? ''
        : 's'
    } ago`;
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  );
}

function getNotificationIcon(
  type: string,
): string {
  if (
    type ===
    'wallet.deposit.completed'
  ) {
    return '\u20B9';
  }

  if (
    type ===
    'wallet.withdrawal.completed'
  ) {
    return '\u2193';
  }

  if (
    type ===
    'wallet.transfer.sent'
  ) {
    return '\u2191';
  }

  if (
    type ===
    'wallet.transfer.received'
  ) {
    return '\u2193';
  }

  if (
    type ===
    'wallet.transfer.completed'
  ) {
    return '\u2197';
  }

  if (
    type ===
    'payment.completed'
  ) {
    return '\u2713';
  }

  if (
    type ===
    'user.registered'
  ) {
    return '\u2605';
  }

  return '\u2022';
}

export default function NotificationBell() {
  const router =
    useRouter();

  const {
    notifications,
    unreadCount,
    isConnected,
    markNotificationRead,
    clearNotifications,
    removeNotification,
    userId,
  } = useNotifications();

  const [
    isOpen,
    setIsOpen,
  ] = useState(false);
  const [
    notificationFilter,
    setNotificationFilter,
  ] = useState<'ALL' | 'UNREAD'>('ALL');
  const [actionError, setActionError] = useState('');

  const filteredNotifications =
    notificationFilter === 'UNREAD'
      ? notifications.filter(
          (notification) =>
            !notification.isRead,
        )
      : notifications;


  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ): void {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(
          event.target,
        )
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(
      event: KeyboardEvent,
    ): void {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    document.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );

      document.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, []);

  async function markAsRead(
    notification:
      RealtimeNotification,
  ): Promise<void> {
    if (notification.isRead) {
      return;
    }

    markNotificationRead(
      notification.id,
    );

    try {
      await userAuthenticatedRequest(
        `/notifications/${notification.id}/read`,
        { method: 'PATCH' },
      );
    } catch {
      /*
       * The local UI remains responsive even if
       * the persistence request temporarily fails.
       */
    }
  }

  async function handleNotificationClick(
    notification:
      RealtimeNotification,
  ): Promise<void> {
    await markAsRead(
      notification,
    );

    setIsOpen(false);

    if (
      !notification.metadata ||
      typeof notification.metadata !==
        'object'
    ) {
      return;
    }

    const metadata =
      notification.metadata as
        Record<string, unknown>;

    const transactionId =
      metadata['transactionId'] ??
      metadata['transferId'] ??
      metadata['depositId'] ??
      metadata['withdrawalId'];

    if (
      typeof transactionId !==
        'string' ||
      !transactionId.trim()
    ) {
      return;
    }

    router.push(
      `/transactions?transactionId=${encodeURIComponent(
        transactionId,
      )}`,
    );
  }

  async function clearNotificationHistory():
    Promise<void> {
    if (!userId || notifications.length === 0) {
      return;
    }

    const confirmed =
      window.confirm(
        'Clear all notification history?',
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionError('');
      await userAuthenticatedRequest(
        '/notifications',
        { method: 'DELETE' },
      );

      clearNotifications();
    } catch {
      setActionError('Unable to clear notification history. Please try again.');
    }
  }

  async function deleteNotification(
    notificationId: string,
  ): Promise<void> {
    if (!userId) {
      return;
    }

    const confirmed =
      window.confirm(
        'Delete this notification?',
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionError('');
      await userAuthenticatedRequest(
        '/notifications/' + encodeURIComponent(notificationId),
        { method: 'DELETE' },
      );

      removeNotification(
        notificationId,
      );
    } catch {
      setActionError('Unable to delete that notification. Please try again.');
    }
  }

  async function markAllAsRead():
    Promise<void> {
    if (!userId) {
      return;
    }

    const unreadNotifications =
      notifications.filter(
        (notification) =>
          !notification.isRead,
      );

    if (unreadNotifications.length === 0) {
      return;
    }

    unreadNotifications.forEach(
      (notification) => {
        markNotificationRead(
          notification.id,
        );
      },
    );

    try {
      setActionError('');
      await userAuthenticatedRequest(
        '/notifications/read-all',
        { method: 'PATCH' },
      );
    } catch {
      setActionError('Unable to mark notifications as read. Please try again.');
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        aria-controls="customer-notifications-panel"
        onClick={() =>
          setIsOpen(
            (current) =>
              !current,
          )
        }
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082A23.848 23.848 0 0 0 18 16.75c-1.253-1.431-2-3.27-2-5.25v-.75a4 4 0 1 0-8 0v.75c0 1.98-.747 3.819-2 5.25 1.028.16 2.078.27 3.143.332m5.714 0a3 3 0 0 1-5.714 0m5.714 0a24.255 24.255 0 0 1-5.714 0"
          />
        </svg>

        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow-sm">
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        ) : null}

        <span
          title={
            isConnected
              ? 'Real-time connected'
              : 'Real-time disconnected'
          }
          className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
            isConnected
              ? 'bg-emerald-500'
              : 'bg-slate-300'
          }`}
        />
      </button>

      {isOpen ? (
        <div id="customer-notifications-panel" role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-bold text-slate-900">
                Notifications
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {isConnected
                  ? 'Live updates connected'
                  : 'Connecting to live updates'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {notifications.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  void clearNotificationHistory()
                }
                className="text-sm font-semibold text-red-600 transition hover:text-red-700"
              >
                Clear history
              </button>
            ) : null}

            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() =>
                  void markAllAsRead()
                }
                className="text-sm font-semibold text-sky-600 transition hover:text-sky-700"
              >
                Mark all read
              </button>
            ) : null}
            </div>
          </div>

          <div className="flex gap-2 border-b border-slate-200 px-5 py-3">
            <button
              type="button"
              onClick={() =>
                setNotificationFilter('ALL')
              }
              className={
                notificationFilter === 'ALL'
                  ? 'rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white'
                  : 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200'
              }
            >
              All ({notifications.length})
            </button>

            <button
              type="button"
              onClick={() =>
                setNotificationFilter('UNREAD')
              }
              className={
                notificationFilter === 'UNREAD'
                  ? 'rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white'
                  : 'rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100'
              }
            >
              Unread ({unreadCount})
            </button>
          </div>

          {actionError ? (
            <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {actionError}
            </p>
          ) : null}

          <div className="max-h-96 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[0px]">
                  <span className="text-2xl">&#128276;</span>
                </div>

                <p className="mt-4 font-semibold text-slate-700">
                  No notifications found
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Your wallet and payment notifications will appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map(
                (notification) => (
                  <div
                    key={notification.id}
                    className={`flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 transition last:border-b-0 hover:bg-slate-50 sm:px-4 ${
                      notification.isRead
                        ? 'bg-white'
                        : 'bg-sky-50/70'
                    }`}
                  >
                    <button type="button" onClick={() => void handleNotificationClick(notification)} className="flex min-w-0 flex-1 gap-3 rounded-xl px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-700">
                      {getNotificationIcon(
                        notification.type,
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-slate-900">
                          {notification.title}
                        </span>

                        {!notification.isRead ? (
                          <span aria-label="Unread" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                        ) : null}
                      </span>

                      <span className="mt-1 block text-sm leading-5 text-slate-600">
                        {notification.message}
                      </span>

                      <span className="mt-2 block text-xs font-medium text-slate-400">
                        {formatRelativeTime(
                          notification.createdAt,
                        )}
                      </span>
                    </span>
                    </button>
                    <button type="button" aria-label={`Delete notification: ${notification.title}`} title="Delete notification" onClick={() => void deleteNotification(notification.id)} className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600">&times;</button>
                  </div>
                ),
              )
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-center text-xs text-slate-500">
            Showing persistent notification history with real-time updates
          </div>
        </div>
      ) : null}
    </div>
  );
}







