import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import type { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs';

import { MetricsService } from './metrics.service';

type AuthMetricOperation =
  | 'register'
  | 'login'
  | 'refresh'
  | 'logout';

type HttpRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  path?: string;
  route?: {
    path?: string;
  };
};

@Injectable()
export class AuthOperationMetricsInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly metrics: MetricsService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request =
      context
        .switchToHttp()
        .getRequest<HttpRequest>();

    const operation =
      this.resolveOperation(request);

    if (!operation) {
      return next.handle();
    }

    const startedAt = Date.now();
    let outcome: 'success' | 'failure' = 'failure';

    return next.handle().pipe(
      tap({
        next: () => {
          outcome = 'success';
        },
        error: () => {
          outcome = 'failure';
        },
      }),

      finalize(() => {
        const durationSeconds =
          Math.max(
            0,
            Date.now() - startedAt,
          ) / 1000;

        this.metrics.recordAuthOperation(
          operation,
          outcome,
          durationSeconds,
        );
      }),
    );
  }

  private resolveOperation(
    request: HttpRequest,
  ): AuthMetricOperation | null {
    if (
      String(request.method ?? '')
        .toUpperCase() !== 'POST'
    ) {
      return null;
    }

    const rawPath =
      request.route?.path ??
      request.path ??
      request.originalUrl ??
      request.url ??
      '';

    const path =
      rawPath
        .split('?')[0]
        .replace(/\/+$/, '')
        .toLowerCase();

    if (path.endsWith('/register')) {
      return 'register';
    }

    if (path.endsWith('/login')) {
      return 'login';
    }

    if (path.endsWith('/refresh')) {
      return 'refresh';
    }

    if (path.endsWith('/logout')) {
      return 'logout';
    }

    return null;
  }
}