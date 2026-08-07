import {
  Injectable,
  Logger,
} from '@nestjs/common';


import {
  PrismaService,
} from '@payflow/database';

export type CreateAuditLogInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditLogService {
  private readonly logger =
    new Logger(
      AuditLogService.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async create(
    input: CreateAuditLogInput,
  ) {
    try {
      return await this.prisma
        .auditLog.create({
          data: {
            actorUserId:
              input.actorUserId ??
              null,

            actorEmail:
              input.actorEmail ??
              null,

            action:
              input.action,

            targetType:
              input.targetType,

            targetId:
              input.targetId ??
              null,

            description:
              input.description ??
              null,

            metadata:
              input.metadata === null ||
              input.metadata === undefined
                ? undefined
                : (input.metadata as never),

            ipAddress:
              input.ipAddress ??
              null,

            userAgent:
              input.userAgent ??
              null,
          },
        });
    } catch (error) {
      /*
       * An audit-log failure should be visible
       * in server logs. The calling business
       * operation may decide whether to fail.
       */
      this.logger.error(
        'Unable to create audit log',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  async findAll(
    input: {
      page?: number;
      limit?: number;
      action?: string;
      targetType?: string;
      actorUserId?: string;
    } = {},
  ) {
    const page =
      Number.isFinite(input.page) &&
      Number(input.page) > 0
        ? Math.floor(
            Number(input.page),
          )
        : 1;

    const limit =
      Number.isFinite(input.limit) &&
      Number(input.limit) > 0
        ? Math.min(
            Math.floor(
              Number(input.limit),
            ),
            100,
          )
        : 20;

    const where = {
      ...(input.action
        ? {
            action:
              input.action,
          }
        : {}),

      ...(input.targetType
        ? {
            targetType:
              input.targetType,
          }
        : {}),

      ...(input.actorUserId
        ? {
            actorUserId:
              input.actorUserId,
          }
        : {}),
    };

    const [
      total,
      auditLogs,
    ] = await Promise.all([
      this.prisma.auditLog.count({
        where,
      }),

      this.prisma.auditLog.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        skip:
          (page - 1) *
          limit,

        take: limit,
      }),
    ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total / limit,
          );

    return {
      auditLogs,

      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPreviousPage:
          page > 1,
      },

      filters: {
        action:
          input.action ?? '',
        targetType:
          input.targetType ?? '',
        actorUserId:
          input.actorUserId ?? '',
      },
    };
  }

  async findById(
    auditLogId: string,
  ) {
    return this.prisma
      .auditLog.findUnique({
        where: {
          id: auditLogId,
        },
      });
  }
}