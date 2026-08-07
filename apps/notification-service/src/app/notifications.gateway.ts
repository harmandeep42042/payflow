import {
  Logger,
} from '@nestjs/common';

import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import {
  Server,
  Socket,
} from 'socket.io';

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
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  updatedAt: string;
};

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway {
  private readonly logger =
    new Logger(
      NotificationsGateway.name,
    );

  @WebSocketServer()
  server!: Server;

  @SubscribeMessage(
    'notifications.join',
  )
  joinNotifications(
    @MessageBody()
    body: {
      userId?: string;
    },

    @ConnectedSocket()
    client: Socket,
  ): void {
    const userId =
      body?.userId?.trim();

    if (!userId) {
      return;
    }

    void client.join(
      this.getUserRoom(userId),
    );

    this.logger.log(
      `Notification socket joined for user ${userId}`,
    );
  }

  @SubscribeMessage(
    'notifications.leave',
  )
  leaveNotifications(
    @MessageBody()
    body: {
      userId?: string;
    },

    @ConnectedSocket()
    client: Socket,
  ): void {
    const userId =
      body?.userId?.trim();

    if (!userId) {
      return;
    }

    void client.leave(
      this.getUserRoom(userId),
    );
  }

  emitToUser(
    userId: string | undefined,
    notification:
      RealtimeNotification,
  ): void {
    const normalizedUserId =
      userId?.trim();

    if (!normalizedUserId) {
      this.logger.warn(
        `Notification ${notification.id} has no userId`,
      );

      return;
    }

    this.server
      .to(
        this.getUserRoom(
          normalizedUserId,
        ),
      )
      .emit(
        'notification.created',
        {
          notification,
        },
      );
  }

  private getUserRoom(
    userId: string,
  ): string {
    return `user:${userId}`;
  }
}
