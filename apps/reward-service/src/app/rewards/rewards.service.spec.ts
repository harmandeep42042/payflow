import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('@payflow/database', () => ({
  PrismaService: class PrismaService {},
}));

import { RewardsService } from './rewards.service';

describe('RewardsService', () => {
  const wallet = {
    id: 'wallet-1',
    userId: 'user-1',
    currency: 'INR',
    status: 'ACTIVE',
  };
  const reward = {
    id: 'reward-1',
    userId: 'user-1',
    walletId: 'wallet-1',
    paymentId: 'payment-1',
    rewardType: 'SCRATCH_CARD',
    amount: 1,
    currency: 'INR',
    status: 'AVAILABLE',
  };

  function createHarness() {
    const prisma = {
      wallet: {
        findFirst:
          jest.fn().mockResolvedValue(wallet),
      },
      reward: {
        findMany:
          jest.fn().mockResolvedValue([reward]),
        findUnique:
          jest.fn().mockResolvedValue(null),
        create:
          jest.fn().mockResolvedValue(reward),
      },
    };
    const service = new RewardsService(
      prisma as never,
    );

    return {
      service,
      prisma,
    };
  }

  it('bounds the customer reward history query', async () => {
    const harness = createHarness();

    await harness.service.getUserRewards('user-1');

    expect(harness.prisma.reward.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('creates a scratch-card Reward with the existing business rules', async () => {
    const harness = createHarness();

    const result =
      await harness.service
        .generateScratchCard(
          'user-1',
          'wallet-1',
          'payment-1',
        );

    expect(result).toEqual({
      success: true,
      created: true,
      reward,
    });
    expect(
      harness.prisma.reward.create,
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        walletId: 'wallet-1',
        paymentId: 'payment-1',
        rewardType: 'SCRATCH_CARD',
        amount: expect.any(Number),
        currency: 'INR',
        status: 'AVAILABLE',
        expiresAt: expect.any(Date),
      }),
    });

    const createInput =
      harness.prisma.reward.create
        .mock.calls[0][0].data;
    expect(createInput.amount)
      .toBeGreaterThanOrEqual(1);
    expect(createInput.amount)
      .toBeLessThanOrEqual(20);
  });

  it('returns an existing Reward for a sequential duplicate payment', async () => {
    const harness = createHarness();
    harness.prisma.reward.findUnique
      .mockResolvedValue(reward);

    const result =
      await harness.service
        .generateScratchCard(
          'user-1',
          'wallet-1',
          'payment-1',
        );

    expect(result).toEqual({
      success: true,
      created: false,
      reward,
    });
    expect(
      harness.prisma.reward.create,
    ).not.toHaveBeenCalled();
  });

  it('returns the winning Reward after a concurrent paymentId conflict', async () => {
    const harness = createHarness();
    const conflict = {
      code: 'P2002',
      meta: {
        target: ['paymentId'],
      },
    };
    harness.prisma.reward.create
      .mockRejectedValue(conflict);
    harness.prisma.reward.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(reward);

    const result =
      await harness.service
        .generateScratchCard(
          'user-1',
          'wallet-1',
          'payment-1',
        );

    expect(result).toEqual({
      success: true,
      created: false,
      reward,
    });
  });

  it.each([
    new Error('Database unavailable'),
    {
      code: 'P2002',
      meta: {
        target: ['anotherField'],
      },
    },
  ])(
    'rethrows unrelated creation errors',
    async (error) => {
      const harness = createHarness();
      harness.prisma.reward.create
        .mockRejectedValue(error);

      await expect(
        harness.service
          .generateScratchCard(
            'user-1',
            'wallet-1',
            'payment-1',
          ),
      ).rejects.toBe(error);
    },
  );

  it('rejects missing user and wallet identifiers', async () => {
    const harness = createHarness();

    await expect(
      harness.service.generateScratchCard(
        '',
        'wallet-1',
        'payment-1',
      ),
    ).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a wallet that does not belong to the user', async () => {
    const harness = createHarness();
    harness.prisma.wallet.findFirst
      .mockResolvedValue(null);

    await expect(
      harness.service
        .generateScratchCard(
          'user-1',
          'wallet-1',
          'payment-1',
        ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
