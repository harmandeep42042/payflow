import { OutboxEventProducer } from '@payflow/shared-events';

import { OutboxService } from './outbox.service';

describe('OutboxService atomic claims', () => {
  const workerA = 'worker-a';
  const workerB = 'worker-b';

  it('atomically claims only retryable pending Wallet events', async () => {
    const event = {
      id: 'event-1',
      producer: OutboxEventProducer.Wallet,
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
    };

    const claimedEvent = {
      ...event,
      status: 'PROCESSING',
      claimedBy: workerA,
      claimedAt: new Date(),
    };

    const prisma = {
      outboxEvent: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),

        findMany: jest.fn().mockResolvedValue([event]),

        findUnique: jest.fn().mockResolvedValue(claimedEvent),
      },
    };

    const service = new OutboxService(prisma as never);

    const result = await service.claimPendingEvents(workerA);

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        producer: OutboxEventProducer.Wallet,

        status: 'PENDING',

        attempts: {
          lt: 5,
        },
      },

      orderBy: {
        createdAt: 'asc',
      },

      take: 20,
    });

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'event-1',

        status: 'PROCESSING',

        claimedBy: workerA,
      }),
    );
  });

  it('allows only one worker to win the same claim', async () => {
    const event = {
      id: 'event-race',

      producer: OutboxEventProducer.Wallet,

      status: 'PENDING',

      attempts: 0,

      createdAt: new Date(),
    };

    const winnerPrisma = {
      outboxEvent: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),

        findMany: jest.fn().mockResolvedValue([event]),

        findUnique: jest.fn().mockResolvedValue({
          ...event,
          status: 'PROCESSING',
          claimedBy: workerA,
          claimedAt: new Date(),
        }),
      },
    };

    const loserPrisma = {
      outboxEvent: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 0 }),

        findMany: jest.fn().mockResolvedValue([event]),

        findUnique: jest.fn(),
      },
    };

    const winner = new OutboxService(winnerPrisma as never);

    const loser = new OutboxService(loserPrisma as never);

    const winnerResult = await winner.claimPendingEvents(workerA);

    const loserResult = await loser.claimPendingEvents(workerB);

    expect(winnerResult).toHaveLength(1);

    expect(loserResult).toHaveLength(0);

    expect(loserPrisma.outboxEvent.findUnique).not.toHaveBeenCalled();
  });

  it('recovers stale PROCESSING claims', async () => {
    const updateMany = jest.fn().mockResolvedValue({
      count: 2,
    });

    const prisma = {
      outboxEvent: {
        updateMany,
      },
    };

    const service = new OutboxService(prisma as never);

    const result = await service.recoverStaleClaims();

    const call = updateMany.mock.calls[0][0];

    expect(call.where).toEqual(
      expect.objectContaining({
        producer: OutboxEventProducer.Wallet,

        status: 'PROCESSING',

        claimedAt: {
          lt: expect.any(Date),
        },
      }),
    );

    expect(call.data).toEqual(
      expect.objectContaining({
        status: 'PENDING',

        claimedAt: null,

        claimedBy: null,
      }),
    );

    expect(result).toEqual({
      count: 2,
    });
  });

  it('allows only the claim owner to mark an event PUBLISHED', async () => {
    const updateMany = jest.fn().mockResolvedValue({
      count: 1,
    });

    const prisma = {
      outboxEvent: {
        updateMany,
      },
    };

    const service = new OutboxService(prisma as never);

    await service.markPublished('event-success', workerA);

    const call = updateMany.mock.calls[0][0];

    expect(call.where).toEqual({
      id: 'event-success',

      status: 'PROCESSING',

      claimedBy: workerA,
    });

    expect(call.data.status).toBe('PUBLISHED');

    expect(call.data.publishedAt).toBeInstanceOf(Date);

    expect(call.data.lastError).toBeNull();

    expect(call.data.claimedAt).toBeNull();

    expect(call.data.claimedBy).toBeNull();
  });

  it('rejects completion when worker lost the claim', async () => {
    const prisma = {
      outboxEvent: {
        updateMany: jest.fn().mockResolvedValue({
          count: 0,
        }),
      },
    };

    const service = new OutboxService(prisma as never);

    await expect(service.markPublished('event-lost', workerB)).rejects.toThrow(
      'Outbox publish claim lost before completion: event-lost',
    );
  });

  it('records publish failure and releases event for retry', async () => {
    const prisma = {
      outboxEvent: {
        findFirst: jest.fn().mockResolvedValue({
          attempts: 0,
        }),

        updateMany: jest.fn().mockResolvedValue({
          count: 1,
        }),

        findUnique: jest.fn().mockResolvedValue({
          id: 'event-failure',

          attempts: 1,

          status: 'PENDING',
        }),
      },
    };

    const service = new OutboxService(prisma as never);

    const result = await service.recordPublishFailure(
      'event-failure',
      new Error('RabbitMQ unavailable'),
      workerA,
    );

    const call = prisma.outboxEvent.updateMany.mock.calls[0][0];

    expect(call.data).toEqual({
      attempts: 1,

      status: 'PENDING',

      lastError: 'RabbitMQ unavailable',

      claimedAt: null,

      claimedBy: null,
    });

    expect(result).toEqual(
      expect.objectContaining({
        attempts: 1,

        status: 'PENDING',
      }),
    );
  });

  it('moves event to FAILED on fifth failure', async () => {
    const prisma = {
      outboxEvent: {
        findFirst: jest.fn().mockResolvedValue({
          attempts: 4,
        }),

        updateMany: jest.fn().mockResolvedValue({
          count: 1,
        }),

        findUnique: jest.fn().mockResolvedValue({
          id: 'event-final',

          attempts: 5,

          status: 'FAILED',
        }),
      },
    };

    const service = new OutboxService(prisma as never);

    const result = await service.recordPublishFailure(
      'event-final',
      new Error('Broker unavailable'),
      workerA,
    );

    const call = prisma.outboxEvent.updateMany.mock.calls[0][0];

    expect(call.data.status).toBe('FAILED');

    expect(call.data.attempts).toBe(5);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'FAILED',

        attempts: 5,
      }),
    );
  });

  it('prevents another worker from recording failure on a foreign claim', async () => {
    const prisma = {
      outboxEvent: {
        findFirst: jest.fn().mockResolvedValue(null),

        updateMany: jest.fn(),

        findUnique: jest.fn(),
      },
    };

    const service = new OutboxService(prisma as never);

    const result = await service.recordPublishFailure(
      'foreign-event',
      new Error('foreign worker'),
      workerB,
    );

    expect(result).toBeNull();

    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
  });
});
