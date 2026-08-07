import {
  Logger,
} from '@nestjs/common';

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import {
  Server,
  Socket,
} from 'socket.io';

type JoinUserRoomPayload = {
  userId: string;
};

type RealtimeNotification = {
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
  createdAt: Date;
  readAt: Date | null;
  updatedAt: Date;
};

@WebSocketGateway({
  namespace: '/notifications',

  cors: {
    origin:
      true,

    credentials:
      true,
  },
})
export class NotificationsGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect
{
  private readonly logger =
    new Logger(
      NotificationsGateway.name,
    );

  @WebSocketServer()
  private readonly server!:
    Server;

  handleConnection(
    client: Socket,
  ): void {
    this.logger.log(
      `Socket connected: ${client.id}`,
    );
  }

  handleDisconnect(
    client: Socket,
  ): void {
    this.logger.log(
      `Socket disconnected: ${client.id}`,
    );
  }

  @SubscribeMessage(
    'notifications.join',
  )
  async joinUserRoom(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: JoinUserRoomPayload,
  ) {
    const userId =
      payload?.userId?.trim();

    if (!userId) {
      return {
        success:
          false,

        message:
          'userId is required',
      };
    }

    const room =
      this.getUserRoom(
        userId,
      );

    await client.join(room);

    this.logger.log(
      `Socket ${client.id} joined ${room}`,
    );

    return {
      success:
        true,

      room,
    };
  }

  @SubscribeMessage(
    'notifications.leave',
  )
  async leaveUserRoom(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: JoinUserRoomPayload,
  ) {
    const userId =
      payload?.userId?.trim();

    if (!userId) {
      return {
        success:
          false,

        message:
          'userId is required',
      };
    }

    const room =
      this.getUserRoom(
        userId,
      );

    await client.leave(room);

    return {
      success:
        true,

      room,
    };
  }

  emitNotificationCreated(
    notification:
      RealtimeNotification,
  ): void {
    if (!notification.userId) {
      this.logger.warn(
        `Notification ${notification.id} has no userId; real-time event skipped`,
      );

      return;
    }

    const room =
      this.getUserRoom(
        notification.userId,
      );

    this.server
      .to(room)
      .emit(
        'notification.created',
        {
          notification,
        },
      );

    this.logger.log(
      `notification.created emitted to ${room}`,
    );
  }

  private getUserRoom(
    userId: string,
  ): string {
    return `user:${userId}`;
  }
}