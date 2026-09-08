import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@payflow/database';

import { OutboxEventProducer } from '@payflow/shared-events';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  private readonly maxAttempts = 5;

  private readonly staleClaimMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async recoverStaleClaims() {
    const staleBefore = new Date(Date.now() - this.staleClaimMs);

    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        producer: OutboxEventProducer.Wallet,

        status: 'PROCESSING',

        claimedAt: {
          lt: staleBefore,
        },
      },

      data: {
        status: 'PENDING',

        claimedAt: null,

        claimedBy: null,

        lastError: 'Recovered stale outbox processing claim',
      },
    });

    if (result.count > 0) {
      this.logger.warn(`Recovered ${result.count} stale outbox claim(s)`);
    }

    return result;
  }

  async claimPendingEvents(workerId: string, limit = 20) {
    await this.recoverStaleClaims();

    const candidates = await this.prisma.outboxEvent.findMany({
      where: {
        producer: OutboxEventProducer.Wallet,

        status: 'PENDING',

        attempts: {
          lt: this.maxAttempts,
        },
      },

      orderBy: {
        createdAt: 'asc',
      },

      take: limit,
    });

    const claimed = [];

    for (const candidate of candidates) {
      const claimedAt = new Date();

      /*
       * Atomic claim gate.
       *
       * Multiple replicas may read the same
       * PENDING candidate, but only one can
       * successfully transition:
       *
       * PENDING -> PROCESSING
       */
      const claim = await this.prisma.outboxEvent.updateMany({
        where: {
          id: candidate.id,

          producer: OutboxEventProducer.Wallet,

          status: 'PENDING',

          attempts: {
            lt: this.maxAttempts,
          },
        },

        data: {
          status: 'PROCESSING',

          claimedAt,

          claimedBy: workerId,
        },
      });

      if (claim.count !== 1) {
        continue;
      }

      const event = await this.prisma.outboxEvent.findUnique({
        where: {
          id: candidate.id,
        },
      });

      if (event) {
        claimed.push(event);
      }
    }

    return claimed;
  }

  async markPublished(id: string, workerId: string) {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,

        status: 'PROCESSING',

        claimedBy: workerId,
      },

      data: {
        status: 'PUBLISHED',

        publishedAt: new Date(),

        lastError: null,

        claimedAt: null,

        claimedBy: null,
      },
    });

    if (result.count !== 1) {
      throw new Error(`Outbox publish claim lost before completion: ${id}`);
    }

    return result;
  }

  async recordPublishFailure(id: string, error: unknown, workerId: string) {
    const message = error instanceof Error ? error.message : String(error);

    const current = await this.prisma.outboxEvent.findFirst({
      where: {
        id,

        status: 'PROCESSING',

        claimedBy: workerId,
      },

      select: {
        attempts: true,
      },
    });

    if (!current) {
      return null;
    }

    const nextAttempts = current.attempts + 1;

    const nextStatus = nextAttempts >= this.maxAttempts ? 'FAILED' : 'PENDING';

    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,

        status: 'PROCESSING',

        claimedBy: workerId,
      },

      data: {
        attempts: nextAttempts,

        status: nextStatus,

        lastError: message.slice(0, 2000),

        claimedAt: null,

        claimedBy: null,
      },
    });

    if (result.count !== 1) {
      return null;
    }

    return this.prisma.outboxEvent.findUnique({
      where: {
        id,
      },
    });
  }
}
