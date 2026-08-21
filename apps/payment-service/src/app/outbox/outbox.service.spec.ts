import {
  OutboxEventProducer,
} from '@payflow/shared-events';

jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import {
  OutboxService,
} from './outbox.service';

describe('Payment OutboxService', () => {
  it('selects only pending Payment-owned events', async () => {
    const prisma = {
      outboxEvent: {
        findMany:
          jest.fn().mockResolvedValue([]),
      },
    };
    const service =
      new OutboxService(prisma as never);

    await service.getPendingEvents();

    expect(
      prisma.outboxEvent.findMany,
    ).toHaveBeenCalledWith({
      where: {
        producer:
          OutboxEventProducer.Payment,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 20,
    });
  });

  it('does not select Wallet-owned events for the Payment relay', async () => {
    const events = [
      {
        id: 'payment-event-1',
        producer:
          OutboxEventProducer.Payment,
        status: 'PENDING',
      },
      {
        id: 'wallet-event-1',
        producer:
          OutboxEventProducer.Wallet,
        status: 'PENDING',
      },
    ];
    const prisma = {
      outboxEvent: {
        findMany: jest.fn(
          ({ where }) =>
            Promise.resolve(
              events.filter(
                (event) =>
                  event.producer ===
                    where.producer &&
                  event.status ===
                    where.status,
              ),
            ),
        ),
      },
    };
    const service =
      new OutboxService(prisma as never);

    const result =
      await service.getPendingEvents();

    expect(result).toEqual([events[0]]);
    expect(result).not.toContainEqual(
      events[1],
    );
  });

  it('marks a published event with its publication time', async () => {
    const prisma = {
      outboxEvent: {
        update:
          jest.fn().mockResolvedValue({}),
      },
    };
    const service =
      new OutboxService(prisma as never);

    await service.markPublished(
      'payment-event-1',
    );

    expect(
      prisma.outboxEvent.update,
    ).toHaveBeenCalledWith({
      where: {
        id: 'payment-event-1',
      },
      data: {
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
      },
    });
  });
});
