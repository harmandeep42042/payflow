import type { Response } from 'express';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let metricsService: MetricsService;
  let controller: MetricsController;
  let response: Response;

  beforeEach(() => {
    metricsService = new MetricsService();
    controller = new MetricsController(metricsService);

    response = {
      setHeader: jest.fn(),
    } as unknown as Response;
  });

  it('should expose Prometheus metrics with the registry content type', async () => {
    const result =
      await controller.getMetrics(response);

    expect(result).toContain('# HELP');
    expect(result).toContain('# TYPE');

    expect(
      response.setHeader,
    ).toHaveBeenCalledWith(
      'Content-Type',
      metricsService.getContentType(),
    );
  });

  it('should expose payment operation metrics', async () => {
    metricsService.recordPaymentOperation(
      'create_order',
      'success',
      0.1,
    );

    const result =
      await controller.getMetrics(response);

    expect(result).toContain(
      'payflow_payment_operations_total',
    );

    expect(result).toContain(
      'operation="create_order"',
    );

    expect(result).toContain(
      'outcome="success"',
    );
  });

  it('should expose payment duration histogram', async () => {
    metricsService.recordPaymentOperation(
      'create_order',
      'success',
      0.1,
    );

    const result =
      await controller.getMetrics(response);

    expect(result).toContain(
      'payflow_payment_operation_duration_seconds',
    );
  });

  it('should expose webhook metrics', async () => {
    metricsService.recordWebhookEvent(
      'ingest',
      'accepted',
    );

    const result =
      await controller.getMetrics(response);

    expect(result).toContain(
      'payflow_payment_webhook_events_total',
    );
  });

  it('should expose recovery metrics', async () => {
    metricsService.recordRecoveryEvent(
      'reconciliation',
      'authorized',
    );

    const result =
      await controller.getMetrics(response);

    expect(result).toContain(
      'payflow_payment_recovery_events_total',
    );
  });
});