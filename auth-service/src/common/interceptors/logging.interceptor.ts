import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';

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

    let finalStatusCode: number | undefined;

    return next.handle().pipe(
      tap({
        error: (error) => {
          finalStatusCode =
            error instanceof HttpException
              ? error.getStatus()
              : HttpStatus.INTERNAL_SERVER_ERROR;
        },
      }),
      finalize(() => {
        const duration = Date.now() - startedAt;
        const statusCode =
          finalStatusCode ?? response.statusCode;

        this.logger.log(
          `${method} ${url} ${statusCode} - ${duration}ms`,
        );
      }),
    );
  }
}
