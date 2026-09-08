import {
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  AuthHealthController,
} from './auth-health.controller';

describe('AuthHealthController', () => {
  const createController = (
    databaseReady = true,
    redisReady = true,
  ) => {
    const authService = {
      checkDatabaseReadiness:
        jest
          .fn()
          .mockResolvedValue(
            databaseReady,
          ),
    };

    const redisService = {
      checkReadiness:
        jest
          .fn()
          .mockResolvedValue(
            redisReady,
          ),
    };

    const controller =
      new AuthHealthController(
        authService as never,
        redisService as never,
      );

    return {
      controller,
      authService,
      redisService,
    };
  };

  it(
    'returns process-only liveness',
    () => {
      const {
        controller,
        authService,
        redisService,
      } = createController();

      const result =
        controller.getLiveness();

      expect(result.status).toBe('ok');
      expect(result.service)
        .toBe('auth-service');
      expect(result.check)
        .toBe('liveness');

      expect(
        authService
          .checkDatabaseReadiness,
      ).not.toHaveBeenCalled();

      expect(
        redisService
          .checkReadiness,
      ).not.toHaveBeenCalled();
    },
  );

  it(
    'returns ready when database and Redis are ready',
    async () => {
      const {
        controller,
      } = createController();

      const result =
        await controller
          .getReadiness();

      expect(result.status)
        .toBe('ready');

      expect(
        result.dependencies,
      ).toEqual({
        database: true,
        redis: true,
      });
    },
  );

  it(
    'returns 503 when database is unavailable',
    async () => {
      const {
        controller,
      } = createController(
        false,
        true,
      );

      await expect(
        controller.getReadiness(),
      ).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it(
    'returns 503 when Redis is unavailable',
    async () => {
      const {
        controller,
      } = createController(
        true,
        false,
      );

      await expect(
        controller.getReadiness(),
      ).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );
});