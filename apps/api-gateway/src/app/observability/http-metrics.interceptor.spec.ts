import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import {
  of,
  throwError,
} from 'rxjs';

import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';

@Controller('wallet')
class WalletController {
  @Get(':walletId/transactions')
  transactions() {
    return undefined;
  }
}

@Controller('metrics')
class MetricsControllerFixture {
  @Get()
  metrics() {
    return undefined;
  }
}

function buildContext(
  controller: abstract new (...args: never[]) => object,
  handlerName: string,
  method: string,
  statusCode = 200,
): ExecutionContext {
  const handler =
    controller.prototype[
      handlerName as keyof typeof controller.prototype
    ];

  return {
    getType: () => 'http',

    getClass: () => controller,

    getHandler: () => handler,

    switchToHttp: () => ({
      getRequest: () => ({
        method,
      }),

      getResponse: () => ({
        statusCode,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('HttpMetricsInterceptor', () => {
  it('uses Nest route metadata instead of raw URLs', async () => {
    const metrics =
      new MetricsService();

    const interceptor =
      new HttpMetricsInterceptor(
        metrics,
      );

    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    await new Promise<void>(
      (resolve, reject) => {
        interceptor
          .intercept(
            buildContext(
              WalletController,
              'transactions',
              'GET',
            ),
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
      'method="GET"',
    );

    expect(body).toContain(
      'route="wallet/:walletId/transactions"',
    );

    expect(body).toContain(
      'status_class="2xx"',
    );

    expect(body).not.toContain(
      '123e4567-e89b-12d3-a456-426614174000',
    );
  });

  it('records HTTP exception status class', async () => {
    const metrics =
      new MetricsService();

    const interceptor =
      new HttpMetricsInterceptor(
        metrics,
      );

    const next: CallHandler = {
      handle: () =>
        throwError(
          () =>
            new HttpException(
              'blocked',
              HttpStatus.BAD_REQUEST,
            ),
        ),
    };

    await new Promise<void>((resolve) => {
      interceptor
        .intercept(
          buildContext(
            WalletController,
            'transactions',
            'GET',
          ),
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
      'status_class="4xx"',
    );
  });

  it('does not self-count the metrics endpoint', async () => {
    const metrics =
      new MetricsService();

    const interceptor =
      new HttpMetricsInterceptor(
        metrics,
      );

    const next: CallHandler = {
      handle: () => of('metrics'),
    };

    await new Promise<void>(
      (resolve, reject) => {
        interceptor
          .intercept(
            buildContext(
              MetricsControllerFixture,
              'metrics',
              'GET',
            ),
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
      'route="metrics"',
    );
  });
});