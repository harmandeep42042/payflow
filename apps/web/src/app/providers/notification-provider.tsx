'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  io,
  Socket,
} from 'socket.io-client';

import {
  API_GATEWAY_URL,
  getUserAccessToken,
} from '../lib/api';

export type RealtimeNotification = {
  id: string;
  userId: string | null;
  email: string | null;
  type: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  isRead: boolean;
  metadata: unknown;
  createdAt: string;
  readAt: string | null;
  updatedAt: string;
};

type NotificationCreatedPayload = {
  notification: RealtimeNotification;
};

type NotificationHistoryResponse = {
  notifications?: RealtimeNotification[];

  summary?: {
    total?: number;
    unreadCount?: number;
  };

  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
};

export type NotificationContextValue = {
  userId:
    string | null;

  notifications:
    RealtimeNotification[];

  unreadCount:
    number;

  isConnected:
    boolean;

  latestNotification:
    RealtimeNotification | null;

  addNotification: (
    notification:
      RealtimeNotification,
  ) => void;

  markNotificationRead: (
    notificationId: string,
  ) => void;

  removeNotification: (
    notificationId: string,
  ) => void;

  clearNotifications: () => void;
};

export const NotificationContext =
  createContext<
    NotificationContextValue | undefined
  >(undefined);

const notificationSocketUrl =
  API_GATEWAY_URL.replace(
    /\/api\/v1\/?$/,
    '',
  ) + '/notifications';

const notificationApiUrl =
  API_GATEWAY_URL;

function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const payload =
      token.split('.')[1];

    if (!payload) {
      return null;
    }

    const normalized =
      payload
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const decoded =
      window.atob(normalized);

    return JSON.parse(
      decoded,
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseStoredObject(
  key: string,
): Record<string, unknown> | null {
  const value =
    window.localStorage.getItem(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(
      value,
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function findUserId(): string | null {
  const userKeys = [
    'payflow_user_profile',
    'payflow_user',
    'payflowUser',
    'auth_user',
    'authUser',
    'user',
  ];

  for (const key of userKeys) {
    const user =
      parseStoredObject(key);

    const id =
      user?.['id'] ??
      user?.['userId'];

    if (
      typeof id === 'string' &&
      id.trim()
    ) {
      return id.trim();
    }
  }

  const sessionKeys = [
    'payflow_session',
    'auth_session',
    'session',
  ];

  for (const key of sessionKeys) {
    const session =
      parseStoredObject(key);

    const nestedUser =
      session?.['user'];

    if (
      nestedUser &&
      typeof nestedUser === 'object'
    ) {
      const id =
        (
          nestedUser as
            Record<string, unknown>
        )['id'];

      if (
        typeof id === 'string' &&
        id.trim()
      ) {
        return id.trim();
      }
    }
  }

  const tokenKeys = [
    'accessToken',
    'access_token',
    'payflow_access_token',
    'payflowAccessToken',
  ];

  for (const key of tokenKeys) {
    const token =
      window.localStorage
        .getItem(key);

    if (!token) {
      continue;
    }

    const payload =
      decodeJwtPayload(token);

    const id =
      payload?.['sub'] ??
      payload?.['userId'];

    if (
      typeof id === 'string' &&
      id.trim()
    ) {
      return id.trim();
    }
  }

  return null;
}

export function NotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const userId =
    typeof window !== 'undefined'
      ? findUserId()
      : null;

  const [
    notifications,
    setNotifications,
  ] = useState<
    RealtimeNotification[]
  >([]);

  const [
    isConnected,
    setIsConnected,
  ] = useState(false);

  const [
    latestNotification,
    setLatestNotification,
  ] = useState<
    RealtimeNotification | null
  >(null);

  const addNotification =
    useCallback(
      (
        notification:
          RealtimeNotification,
      ): void => {
        setNotifications(
          (current) => {
            const exists =
              current.some(
                (item) =>
                  item.id ===
                  notification.id,
              );

            if (exists) {
              return current;
            }

            return [
              notification,
              ...current,
            ].slice(0, 100);
          },
        );

        setLatestNotification(
          notification,
        );
      },
      [],
    );

  const markNotificationRead =
    useCallback(
      (
        notificationId: string,
      ): void => {
        setNotifications(
          (current) =>
            current.map(
              (notification) =>
                notification.id ===
                notificationId
                  ? {
                      ...notification,
                      isRead: true,
                      readAt:
                        notification.readAt ??
                        new Date()
                          .toISOString(),
                    }
                  : notification,
            ),
        );
      },
      [],
    );

  const clearNotifications =
    useCallback((): void => {
      setNotifications([]);
      setLatestNotification(null);
    }, []);

  const removeNotification =
    useCallback(
      (notificationId: string): void => {
        setNotifications(
          (current) =>
            current.filter(
              (notification) =>
                notification.id !==
                notificationId,
            ),
        );

        setLatestNotification(
          (current) =>
            current?.id === notificationId
              ? null
              : current,
        );
      },
      [],
    );

useEffect(() => {

  if (!userId) {
    return;
  }

  let cancelled =
    false;

  async function loadNotificationHistory():
    Promise<void> {
    try {
      const accessToken =
        getUserAccessToken();

      if (!accessToken) {
        return;
      }

      const query =
        new URLSearchParams({
          page: '1',
          limit: '100',
        });

      const response =
        await fetch(
          notificationApiUrl + '/notifications?' + query.toString(),
          {
            method: 'GET',
            cache: 'no-store',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        );

      if (!response.ok) {
        return;
      }

      const body =
        await response.json() as
          NotificationHistoryResponse;

      if (cancelled) {
        return;
      }

      const history =
        Array.isArray(body.notifications)
          ? body.notifications
          : [];

      setNotifications(
        (current) => {
      const realtimeOnly =
        current.filter(
          (currentNotification) =>
            !history.some(
              (historyNotification) =>
                historyNotification.id ===
                currentNotification.id,
            ),
        );

      const merged = [
        ...history,
        ...realtimeOnly,
      ];

          const unique =
            Array.from(
              new Map(
                merged.map(
                  (notification) => [
                    notification.id,
                    notification,
                  ],
                ),
              ).values(),
            );

          return unique
            .sort(
              (left, right) =>
                new Date(right.createdAt).getTime() -
                new Date(left.createdAt).getTime(),
            )
            .slice(0, 100);
        },
      );
    } catch {
      /* keep realtime notifications working */
    }
  }

  void loadNotificationHistory();

  return () => {
    cancelled = true;
  };
}, [userId]);

  useEffect(() => {

    if (!userId) {
      return;
    }

    const accessToken =
      getUserAccessToken();

    if (!accessToken) {
      return;
    }

    const socket: Socket =
      io(
        notificationSocketUrl,
        {
          transports: [
            'websocket',
            'polling',
          ],

          auth: (
            callback,
          ) => {
            const currentAccessToken =
              getUserAccessToken();

            callback(
              currentAccessToken
                ? {
                    token:
                      currentAccessToken,
                  }
                : {},
            );
          },

          reconnection:
            true,

          reconnectionAttempts:
            Infinity,

          reconnectionDelay:
            1_000,
        },
      );

    socket.on(
      'connect',
      () => {
        setIsConnected(true);
      },
    );

    socket.on(
      'disconnect',
      () => {
        setIsConnected(false);
      },
    );

    socket.on(
      'notification.created',
      (
        payload:
          NotificationCreatedPayload,
      ) => {
        if (
          payload?.notification
        ) {
          addNotification(
            payload.notification,
          );
        }
      },
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [
    addNotification,
  ]);

  const unreadCount =
    useMemo(
      () =>
        notifications.filter(
          (notification) =>
            !notification.isRead,
        ).length,
      [
        notifications,
      ],
    );

  const value =
    useMemo<
      NotificationContextValue
    >(
      () => ({
        userId,
        notifications,
        unreadCount,
        isConnected,
        latestNotification,
        addNotification,
        markNotificationRead,
        removeNotification,
        clearNotifications,
      }),
      [
        userId,
        notifications,
        unreadCount,
        isConnected,
        latestNotification,
        addNotification,
        markNotificationRead,
        removeNotification,
        clearNotifications,
      ],
    );

  return (
    <NotificationContext.Provider
      value={value}
    >
      {children}
    </NotificationContext.Provider>
  );
}



