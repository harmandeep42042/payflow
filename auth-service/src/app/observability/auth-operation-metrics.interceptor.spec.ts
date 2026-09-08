import {
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';

import {
  of,
  throwError,
} from 'rxjs';

import { AuthOperationMetricsInterceptor } from './auth-operation-metrics.interceptor';
import { MetricsService } from './metrics.service';

function contextFor(
  path: string,
  method = 'POST',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        route: {
          path,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthOperationMetricsInterceptor', () => {
  it('records successful auth operations', async () => {
    const metrics =
      new MetricsService();

    const interceptor =
      new AuthOperationMetricsInterceptor(
        metrics,
      );

    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    await new Promise<void>(
      (resolve, reject) => {
        interceptor
          .intercept(
            contextFor('/login'),
            next,
          )
          .subscribe({
            error: reject,
            complete: resolve,
          });
      },
    );

    const body =
      await metrics.getMetrics();

    expect(body).toContain(
      'operation="login"',
    );

    expect(body).toContain(
      'outcome="success"',
    );
  });

  it('records failed auth operations', async () => {
    const metrics =
      new MetricsService();

    const interceptor =
      new AuthOperationMetricsInterceptor(
        metrics,
      );

    const next: CallHandler = {
      handle: () =>
        throwError(
          () => new Error('test failure'),
        ),
    };

    await new Promise<void>((resolve) => {
      interceptor
        .intercept(
          contextFor('/refresh'),
          next,
        )
        .subscribe({
          error: () => resolve(),
          complete: resolve,
        });
    });

    const body =
      await metrics.getMetrics();

    expect(body).toContain(
      'operation="refresh"',
    );

    expect(body).toContain(
      'outcome="failure"',
    );
  });

  it('ignores unrelated routes', async () => {
    const metrics =
      new MetricsService();

    const interceptor =
      new AuthOperationMetricsInterceptor(
        metrics,
      );

    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    await new Promise<void>(
      (resolve, reject) => {
        interceptor
          .intercept(
            contextFor('/health'),
            next,
          )
          .subscribe({
            error: reject,
            complete: resolve,
          });
      },
    );

    const body =
      await metrics.getMetrics();

    expect(body).not.toContain(
      'operation="health"',
    );
  });

  it('ignores non-POST requests', async () => {
    const metrics =
      new MetricsService();

    const interceptor =
      new AuthOperationMetricsInterceptor(
        metrics,
      );

    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    await new Promise<void>(
      (resolve, reject) => {
        interceptor
          .intercept(
            contextFor('/login', 'GET'),
            next,
          )
          .subscribe({
            error: reject,
            complete: resolve,
          });
      },
    );

    const body =
      await metrics.getMetrics();

    expect(body).not.toContain(
      'operation="login"',
    );
  });
});