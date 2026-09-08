import type { Response } from 'express';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('Wallet MetricsController', () => {
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

  it('should expose wallet operation metrics', async () => {
    metricsService.recordWalletOperation(
      'transfer',
      'success',
      0.1,
    );

    const result =
      await controller.getMetrics(
        response,
      );

    expect(result).toContain(
      'payflow_wallet_operations_total',
    );

    expect(result).toContain(
      'operation="transfer"',
    );

    expect(result).toContain(
      'outcome="success"',
    );
  });

  it('should expose wallet operation duration metrics', async () => {
    metricsService.recordWalletOperation(
      'settlement',
      'success',
      0.1,
    );

    const result =
      await controller.getMetrics(
        response,
      );

    expect(result).toContain(
      'payflow_wallet_operation_duration_seconds',
    );
  });

  it('should expose wallet recovery metrics', async () => {
    metricsService.recordRecoveryEvent(
      'transfer_recovery',
      'recovered',
    );

    const result =
      await controller.getMetrics(
        response,
      );

    expect(result).toContain(
      'payflow_wallet_recovery_events_total',
    );

    expect(result).toContain(
      'event="transfer_recovery"',
    );

    expect(result).toContain(
      'outcome="recovered"',
    );
  });
});