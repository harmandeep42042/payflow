'use client';

import {
  useContext,
} from 'react';

import {
  NotificationContext,
  NotificationContextValue,
} from '../providers/notification-provider';

export function useNotifications():
  NotificationContextValue {
  const context =
    useContext(
      NotificationContext,
    );

  if (!context) {
    throw new Error(
      'useNotifications must be used inside NotificationProvider',
    );
  }

  return context;
}