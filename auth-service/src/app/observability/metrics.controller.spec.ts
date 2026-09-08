import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('returns Prometheus metrics with safe headers', async () => {
    const metricsService = new MetricsService();

    metricsService.recordAuthOperation(
      'login',
      'success',
      0.01,
    );

    const controller =
      new MetricsController(metricsService);

    const headers: Record<string, string> = {};

    const response = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    };

    const body =
      await controller.getMetrics(response as never);

    expect(headers['Content-Type']).toContain(
      'text/plain',
    );

    expect(headers['Cache-Control']).toBe(
      'no-store',
    );

    expect(body).toContain(
      'payflow_auth_operations_total',
    );

    expect(body).toContain(
      'payflow_auth_operation_duration_seconds',
    );
  });
});