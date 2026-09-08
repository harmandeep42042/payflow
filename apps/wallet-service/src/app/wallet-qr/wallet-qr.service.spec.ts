import { BadRequestException } from '@nestjs/common';
import { WalletQrService } from './wallet-qr.service';

describe('WalletQrService signed payloads', () => {
  const originalLegacySecret = process.env.QR_SIGNING_SECRET;
  const originalCurrentSecret = process.env.QR_SIGNING_SECRET_CURRENT;
  const originalPreviousSecret = process.env.QR_SIGNING_SECRET_PREVIOUS;

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const walletsService = {
    transferByVpa: jest.fn(),
  };

  const service = new WalletQrService(
    prisma as never,
    walletsService as never,
  );

  beforeAll(() => {
    process.env.QR_SIGNING_SECRET =
      'test-only-qr-signing-secret-32-characters';

    delete process.env.QR_SIGNING_SECRET_CURRENT;
    delete process.env.QR_SIGNING_SECRET_PREVIOUS;
  });

  afterAll(() => {
    if (originalLegacySecret === undefined) {
      delete process.env.QR_SIGNING_SECRET;
    } else {
      process.env.QR_SIGNING_SECRET = originalLegacySecret;
    }

    if (originalCurrentSecret === undefined) {
      delete process.env.QR_SIGNING_SECRET_CURRENT;
    } else {
      process.env.QR_SIGNING_SECRET_CURRENT = originalCurrentSecret;
    }

    if (originalPreviousSecret === undefined) {
      delete process.env.QR_SIGNING_SECRET_PREVIOUS;
    } else {
      process.env.QR_SIGNING_SECRET_PREVIOUS = originalPreviousSecret;
    }
  });

  beforeEach(() => {
    jest.useRealTimers();

    prisma.user.findUnique.mockResolvedValue({
      id: 'user',
      email: 'user@example.test',
      firstName: 'Test',
      lastName: 'User',
      vpa: 'test@payflow',
      status: 'ACTIVE',
      wallets: [
        {
          id: 'wallet',
          currency: 'INR',
          status: 'ACTIVE',
        },
      ],
    });
  });

  it('generates a signed exact-amount QR and verifies its stable idempotency identity', async () => {
    const generated =
      await service.generateMyQr('user', 'inr', '10.25', '5');

    expect(service.verifyPayload(generated.qr.payload)).toEqual(
      expect.objectContaining({
        valid: true,
        vpa: 'test@payflow',
        currency: 'INR',
        amount: '10.25',
        idempotencyKey: generated.payment.idempotencyKey,
      }),
    );
  });

  it('rejects tampered and expired QR payloads', async () => {
    const generated =
      await service.generateMyQr('user', 'INR', '10.00', '1');

    const tampered = generated.qr.payload.replace(
      'amount=10.00',
      'amount=20.00',
    );

    expect(() => service.verifyPayload(tampered)).toThrow(
      BadRequestException,
    );

    jest
      .useFakeTimers()
      .setSystemTime(new Date(Date.now() + 120_000));

    expect(() => service.verifyPayload(generated.qr.payload)).toThrow(
      'expired',
    );
  });

  it('rejects invalid currency, amount and expiry before generating a QR', async () => {
    await expect(
      service.generateMyQr('user', 'INVALID'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.generateMyQr('user', 'INR', '1.001'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.generateMyQr('user', 'INR', '1.00', '0'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifies legacy QR signatures during signing-key rotation', async () => {
    const legacySecret =
      'legacy-test-only-qr-signing-secret-32-characters';

    const currentSecret =
      'current-test-only-qr-signing-secret-32-characters';

    try {
      // PHASE A:
      // Legacy-only configuration signs the original QR.
      process.env.QR_SIGNING_SECRET = legacySecret;
      delete process.env.QR_SIGNING_SECRET_CURRENT;
      delete process.env.QR_SIGNING_SECRET_PREVIOUS;

      const legacyGenerated =
        await service.generateMyQr('user', 'inr', '10.25', '5');

      expect(
        service.verifyPayload(legacyGenerated.qr.payload),
      ).toEqual(
        expect.objectContaining({
          valid: true,
          vpa: 'test@payflow',
          currency: 'INR',
          amount: '10.25',
        }),
      );

      // PHASE B:
      // New key signs new QR.
      // Previous key exists for verification compatibility only.
      process.env.QR_SIGNING_SECRET_CURRENT = currentSecret;
      process.env.QR_SIGNING_SECRET_PREVIOUS = legacySecret;
      delete process.env.QR_SIGNING_SECRET;

      expect(
        service.verifyPayload(legacyGenerated.qr.payload),
      ).toEqual(
        expect.objectContaining({
          valid: true,
        }),
      );

      const currentGenerated =
        await service.generateMyQr('user', 'inr', '10.25', '5');

      expect(
        service.verifyPayload(currentGenerated.qr.payload),
      ).toEqual(
        expect.objectContaining({
          valid: true,
          vpa: 'test@payflow',
          currency: 'INR',
          amount: '10.25',
        }),
      );

      // PHASE C:
      // Previous key is retired.
      // Old QR must fail; current QR must remain valid.
      delete process.env.QR_SIGNING_SECRET_PREVIOUS;

      expect(() =>
        service.verifyPayload(legacyGenerated.qr.payload),
      ).toThrow(BadRequestException);

      expect(
        service.verifyPayload(currentGenerated.qr.payload),
      ).toEqual(
        expect.objectContaining({
          valid: true,
        }),
      );
    } finally {
      // Restore this suite's normal legacy-test configuration.
      process.env.QR_SIGNING_SECRET =
        'test-only-qr-signing-secret-32-characters';

      delete process.env.QR_SIGNING_SECRET_CURRENT;
      delete process.env.QR_SIGNING_SECRET_PREVIOUS;
    }
  });
});
