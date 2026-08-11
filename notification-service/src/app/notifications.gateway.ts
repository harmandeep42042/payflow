import {
  Logger,
} from '@nestjs/common';

import {
  JwtService,
} from '@nestjs/jwt';

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import {
  Server,
  Socket,
} from 'socket.io';

type JoinUserRoomPayload = {
  userId?: string;
};

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  type?: string;
};

type AuthenticatedSocketUser = {
  id: string;
  email: string;
  role: string;
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
    OnGatewayInit,
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

  constructor(
    private readonly jwtService:
      JwtService,
  ) {}

  afterInit(server: Server): void {
    server.use(
      async (client, next) => {
        try {
          const token =
            this.extractAccessToken(
              client,
            );

          if (!token) {
            throw new Error(
              'Access token is required',
            );
          }

          const payload =
            await this.jwtService.verifyAsync<JwtPayload>(
              token,
            );

          if (payload.type === 'refresh') {
            throw new Error(
              'Refresh token cannot be used as an access token',
            );
          }

          if (
            !payload.sub ||
            !payload.email ||
            !payload.role
          ) {
            throw new Error(
              'Invalid access token payload',
            );
          }

          client.data.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
          } satisfies AuthenticatedSocketUser;

          next();
        } catch {
          next(new Error('Unauthorized'));
        }
      },
    );
  }

  handleConnection(
    client: Socket,
  ): void {
    const user =
      this.getAuthenticatedUser(client);

    if (!user) {
      client.disconnect(true);
      return;
    }

    void client.join(
      this.getUserRoom(user.id),
    );

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
    const user =
      this.getAuthenticatedUser(client);
    const requestedUserId =
      payload?.userId?.trim();

    if (!user) {
      return {
        success:
          false,

        message:
          'Unauthorized',
      };
    }

    if (
      requestedUserId &&
      requestedUserId !== user.id
    ) {
      return {
        success:
          false,

        message:
          'Cannot join another user notification room',
      };
    }

    const room =
      this.getUserRoom(
        user.id,
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
    const user =
      this.getAuthenticatedUser(client);
    const requestedUserId =
      payload?.userId?.trim();

    if (!user) {
      return {
        success:
          false,

        message:
          'Unauthorized',
      };
    }

    if (
      requestedUserId &&
      requestedUserId !== user.id
    ) {
      return {
        success:
          false,

        message:
          'Cannot leave another user notification room',
      };
    }

    const room =
      this.getUserRoom(
        user.id,
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

  private extractAccessToken(
    client: Socket,
  ): string | undefined {
    const authToken =
      client.handshake.auth?.token;
    const header =
      client.handshake.headers.authorization;
    const candidate =
      typeof authToken === 'string'
        ? authToken
        : Array.isArray(header)
          ? header[0]
          : header;

    if (!candidate) {
      return undefined;
    }

    const normalized = candidate.trim();

    if (!normalized) {
      return undefined;
    }

    return normalized.replace(
      /^Bearer\s+/i,
      '',
    );
  }

  private getAuthenticatedUser(
    client: Socket,
  ): AuthenticatedSocketUser | undefined {
    return client.data.user as
      | AuthenticatedSocketUser
      | undefined;
  }
}
