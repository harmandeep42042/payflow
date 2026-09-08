import type { Response } from 'express';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('Notification MetricsController', () => {
  let metricsService: MetricsService;
  let controller: MetricsController;
  let response: Response;

  beforeEach(() => {
    metricsService =
      new MetricsService();

    controller =
      new MetricsController(
        metricsService,
      );

    response = {
      setHeader: jest.fn(),
    } as unknown as Response;
  });

  it('should expose Prometheus metrics with registry content type', async () => {
    const result =
      await controller.getMetrics(
        response,
      );

    expect(result).toContain(
      '# HELP',
    );

    expect(result).toContain(
      '# TYPE',
    );

    expect(
      response.setHeader,
    ).toHaveBeenCalledWith(
      'Content-Type',
      metricsService.getContentType(),
    );
  });

  it('should expose notification event metrics', async () => {
    metricsService.recordNotificationEvent(
      'deposit',
      'processed',
    );

    const result =
      await controller.getMetrics(
        response,
      );

    expect(result).toContain(
      'payflow_notification_events_total',
    );

    expect(result).toContain(
      'event="deposit"',
    );

    expect(result).toContain(
      'outcome="processed"',
    );
  });

  it('should expose delivery metrics', async () => {
    metricsService.recordDelivery(
      'email',
      'success',
      0.1,
    );

    const result =
      await controller.getMetrics(
        response,
      );

    expect(result).toContain(
      'payflow_notification_delivery_total',
    );

    expect(result).toContain(
      'payflow_notification_delivery_duration_seconds',
    );
  });

  it('should expose idempotency metrics', async () => {
    metricsService.recordIdempotency(
      'accepted',
    );

    const result =
      await controller.getMetrics(
        response,
      );

    expect(result).toContain(
      'payflow_notification_idempotency_total',
    );

    expect(result).toContain(
      'outcome="accepted"',
    );
  });
});