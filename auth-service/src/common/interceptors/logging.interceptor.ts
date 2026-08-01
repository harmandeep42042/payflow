import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(
    LoggingInterceptor.name,
  );

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest();

    const response = context
      .switchToHttp()
      .getResponse();

    const method = request.method;
    const url = request.originalUrl ?? request.url;
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const duration = Date.now() - startedAt;

        this.logger.log(
          `${method} ${url} ${response.statusCode} - ${duration}ms`,
        );
      }),
    );
  }
}
