jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));
import { NotificationsService } from './notifications.service';

describe('NotificationsService feature-event delivery', () => {
  const prisma = {
    notificationPreference: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  };
  const idempotency = {
    begin: jest.fn().mockResolvedValue({
      action: 'PROCESS',
    }),

    markSent: jest.fn().mockResolvedValue(undefined),

    markFailed: jest.fn().mockResolvedValue(undefined),

    getByDedupeKey: jest.fn(),
  };
  const gateway = { emitNotificationCreated: jest.fn() };
  let service: NotificationsService;
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    prisma.notification.create.mockImplementation(async ({ data }) => ({
      id: 'notification-1',
      ...data,
      isRead: false,
    }));
    service = new NotificationsService(
      prisma as never,
      idempotency as never,
      gateway as never,
    );
  });

  it.each([
    'money.request.created',
    'money.request.accepted',
    'money.request.declined',
    'money.request.cancelled',
    'split.created',
    'split.allocation.paid',
    'offer.claimed',
    'recharge.status',
    'bill.payment.status',
    'mandate.created',
    'mandate.pause',
    'mandate.resume',
    'mandate.cancel',
    'support.case.updated',
  ])(
    'persists %s unread and emits it over the existing gateway',
    async (eventName) => {
      await service.process(eventName, {
        eventId: 'event-1',
        userId: 'recipient-1',
        description: 'Status changed',
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'recipient-1',
          type: eventName,
          status: 'CREATED',
        }),
      });
      expect(gateway.emitNotificationCreated).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'recipient-1', isRead: false }),
      );
    },
  );
});
