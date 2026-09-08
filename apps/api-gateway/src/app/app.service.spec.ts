import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  AppService,
} from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeAll(async () => {
    const app: TestingModule =
      await Test.createTestingModule({
        providers: [
          AppService,
        ],
      }).compile();

    service =
      app.get<AppService>(
        AppService,
      );
  });

  describe('getHealth', () => {
    it('should return gateway health', () => {
      const result =
        service.getHealth();

      expect(result.status).toBe(
        'ok',
      );

      expect(result.service).toBe(
        'api-gateway',
      );

      expect(
        typeof result.timestamp,
      ).toBe('string');

      expect(
        Number.isNaN(
          Date.parse(
            result.timestamp,
          ),
        ),
      ).toBe(false);
    });
  });

  describe('getLiveness', () => {
    it('should return gateway liveness', () => {
      const result =
        service.getLiveness();

      expect(result.status).toBe(
        'ok',
      );

      expect(result.service).toBe(
        'api-gateway',
      );

      expect(result.check).toBe(
        'liveness',
      );

      expect(
        typeof result.timestamp,
      ).toBe('string');
    });
  });

  describe('getReadiness', () => {
    it('should return gateway readiness', () => {
      const result =
        service.getReadiness();

      expect(result.status).toBe(
        'ready',
      );

      expect(result.service).toBe(
        'api-gateway',
      );

      expect(result.check).toBe(
        'readiness',
      );

      expect(
        typeof result.timestamp,
      ).toBe('string');
    });
  });
});