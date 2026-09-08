import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import {
  PATH_METADATA,
} from '@nestjs/common/constants';

import type { Observable } from 'rxjs';

import {
  catchError,
  finalize,
  throwError,
} from 'rxjs';

import { MetricsService } from './metrics.service';

type HttpRequest = {
  method?: string;
};

type HttpResponse = {
  statusCode?: number;
};

type HttpError = {
  status?: number;
  statusCode?: number;
  getStatus?: () => number;
};

@Injectable()
export class HttpMetricsInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly metrics: MetricsService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request =
      context
        .switchToHttp()
        .getRequest<HttpRequest>();

    const response =
      context
        .switchToHttp()
        .getResponse<HttpResponse>();

    const method =
      this.normalizeMethod(request.method);

    const route =
      this.resolveRoute(context);

    if (!route) {
      return next.handle();
    }

    if (route === 'metrics') {
      return next.handle();
    }

    const startedAt = Date.now();

    let explicitErrorStatus:
      | number
      | undefined;

    return next.handle().pipe(
      catchError((error: unknown) => {
        explicitErrorStatus =
          this.resolveErrorStatus(error);

        return throwError(() => error);
      }),

      finalize(() => {
        const statusCode =
          explicitErrorStatus ??
          response.statusCode ??
          200;

        const statusClass =
          this.toStatusClass(statusCode);

        const durationSeconds =
          Math.max(
            0,
            Date.now() - startedAt,
          ) / 1000;

        this.metrics.recordHttpRequest(
          method,
          route,
          statusClass,
          durationSeconds,
        );
      }),
    );
  }

  private resolveRoute(
    context: ExecutionContext,
  ): string | null {
    const controllerPath =
      Reflect.getMetadata(
        PATH_METADATA,
        context.getClass(),
      );

    const handlerPath =
      Reflect.getMetadata(
        PATH_METADATA,
        context.getHandler(),
      );

    const controller =
      this.normalizePathMetadata(
        controllerPath,
      );

    const handler =
      this.normalizePathMetadata(
        handlerPath,
      );

    if (
      controller === null &&
      handler === null
    ) {
      return null;
    }

    return [
      controller,
      handler,
    ]
      .filter(
        (
          value,
        ): value is string =>
          value !== null &&
          value.length > 0,
      )
      .join('/');
  }

  private normalizePathMetadata(
    value: unknown,
  ): string | null {
    if (typeof value === 'string') {
      return value
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
    }

    if (
      Array.isArray(value) &&
      value.length === 1 &&
      typeof value[0] === 'string'
    ) {
      return value[0]
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
    }

    return null;
  }

  private normalizeMethod(
    method: string | undefined,
  ): string {
    const normalized =
      String(method ?? 'UNKNOWN')
        .trim()
        .toUpperCase();

    switch (normalized) {
      case 'GET':
      case 'POST':
      case 'PUT':
      case 'PATCH':
      case 'DELETE':
      case 'HEAD':
      case 'OPTIONS':
        return normalized;

      default:
        return 'OTHER';
    }
  }

  private resolveErrorStatus(
    error: unknown,
  ): number | undefined {
    if (
      typeof error !== 'object' ||
      error === null
    ) {
      return undefined;
    }

    const candidate =
      error as HttpError;

    if (
      typeof candidate.getStatus ===
      'function'
    ) {
      const status =
        candidate.getStatus();

      if (Number.isInteger(status)) {
        return status;
      }
    }

    if (
      Number.isInteger(candidate.status)
    ) {
      return candidate.status;
    }

    if (
      Number.isInteger(
        candidate.statusCode,
      )
    ) {
      return candidate.statusCode;
    }

    return undefined;
  }

  private toStatusClass(
    statusCode: number,
  ): string {
    if (
      statusCode >= 100 &&
      statusCode < 200
    ) {
      return '1xx';
    }

    if (
      statusCode >= 200 &&
      statusCode < 300
    ) {
      return '2xx';
    }

    if (
      statusCode >= 300 &&
      statusCode < 400
    ) {
      return '3xx';
    }

    if (
      statusCode >= 400 &&
      statusCode < 500
    ) {
      return '4xx';
    }

    if (
      statusCode >= 500 &&
      statusCode < 600
    ) {
      return '5xx';
    }

    return 'other';
  }
}