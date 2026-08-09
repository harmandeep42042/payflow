import {
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  Test,
} from '@nestjs/testing';

import {
  PrismaService,
} from '@payflow/database';

import {
  AppService,
} from './app.service';

describe('AppService', () => {
  let service: AppService;

  const prismaMock = {
    user: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module =
      await Test.createTestingModule({
        providers: [
          AppService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    service =
      module.get<AppService>(
        AppService,
      );
  });

  it('should return healthy database status', async () => {
    prismaMock.user.count.mockResolvedValue(
      1,
    );

    const result =
      await service.getData();

    expect(result.status).toBe('ok');

    expect(result.service).toBe(
      'wallet-service',
    );

    expect(result.database).toBe(
      'connected',
    );

    expect(
      typeof result.timestamp,
    ).toBe('string');
  });

  it('should throw when database is unavailable', async () => {
    prismaMock.user.count.mockRejectedValue(
      new Error(
        'Database unavailable',
      ),
    );

    await expect(
      service.getData(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
