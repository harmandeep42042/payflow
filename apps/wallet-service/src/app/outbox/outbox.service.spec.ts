import { OutboxEventProducer } from '@payflow/shared-events';

import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  it('selects only pending Wallet-owned events', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new OutboxService(prisma as never);

    await service.getPendingEvents();

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {
        producer: OutboxEventProducer.Wallet,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 20,
    });
  });

  it('does not select Payment-owned events for the Wallet relay', async () => {
    const events = [
      {
        id: 'wallet-event-1',
        producer: OutboxEventProducer.Wallet,
      },
      {
        id: 'payment-event-1',
        producer: OutboxEventProducer.Payment,
      },
    ];
    const prisma = {
      outboxEvent: {
        findMany: jest.fn(({ where }) =>
          Promise.resolve(
            events.filter(
              (event) => event.producer === where.producer,
            ),
          )),
      },
    };
    const service = new OutboxService(prisma as never);

    const result = await service.getPendingEvents();

    expect(result).toEqual([events[0]]);
    expect(result).not.toContainEqual(events[1]);
  });
});
