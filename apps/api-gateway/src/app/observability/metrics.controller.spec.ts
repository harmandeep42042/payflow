import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('Gateway MetricsController', () => {
  it('returns Gateway metrics with safe headers', async () => {
    const metrics =
      new MetricsService();

    metrics.recordHttpRequest(
      'GET',
      '/api/v1/wallets/:walletId',
      '2xx',
      0.01,
    );

    const controller =
      new MetricsController(metrics);

    const headers: Record<string, string> = {};

    const response = {
      setHeader: (
        name: string,
        value: string,
      ) => {
        headers[name] = value;
      },
    };

    const body =
      await controller.getMetrics(
        response as never,
      );

    expect(
      headers['Content-Type'],
    ).toContain('text/plain');

    expect(
      headers['Cache-Control'],
    ).toBe('no-store');

    expect(body).toContain(
      'payflow_gateway_http_requests_total',
    );

    expect(body).toContain(
      'payflow_gateway_http_request_duration_seconds',
    );

    expect(body).toContain(
      'route="/api/v1/wallets/:walletId"',
    );

    expect(body).toContain(
      'status_class="2xx"',
    );
  });
});