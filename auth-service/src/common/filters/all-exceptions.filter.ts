import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { Request, Response } from 'express';

type DatabaseErrorLike = Error & {
  code?: unknown;
  cause?: unknown;
  driverAdapterError?: {
    cause?: {
      kind?: unknown;
    };
  };
};

@Catch()
export class AllExceptionsFilter
  implements ExceptionFilter
{
  private readonly logger =
    new Logger(AllExceptionsFilter.name);

  catch(
    exception: unknown,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();

    const request =
      ctx.getRequest<Request>();

    const response =
      ctx.getResponse<Response>();

    let status =
      HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const exceptionResponse =
        exception.getResponse();

      if (
        typeof exceptionResponse ===
        'string'
      ) {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse ===
        'object'
      ) {
        const responseBody =
          exceptionResponse as Record<
            string,
            unknown
          >;

        message =
          (responseBody.message as string) ??
          message;
      }
    } else if (
      this.isDatabaseUnavailable(
        exception,
      )
    ) {
      status =
        HttpStatus.SERVICE_UNAVAILABLE;

      message =
        'Authentication service is temporarily unavailable';
    }

    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error
        ? exception.stack
        : String(exception),
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }

  private isDatabaseUnavailable(
    exception: unknown,
  ): boolean {
    if (!(exception instanceof Error)) {
      return false;
    }

    const databaseError =
      exception as DatabaseErrorLike;

    if (
      databaseError.code === 'P1001' ||
      databaseError.code === 'P1002' ||
      databaseError.code === 'P2024'
    ) {
      return true;
    }

    const adapterFailureKind =
      databaseError
        .driverAdapterError
        ?.cause
        ?.kind;

    if (
      adapterFailureKind ===
        'DatabaseNotReachable' ||
      adapterFailureKind ===
        'DatabaseConnectionFailed'
    ) {
      return true;
    }

    const errorMessage =
      exception.message.toLowerCase();

    return (
      errorMessage.includes(
        "can't reach database server",
      ) ||
      errorMessage.includes(
        'database not reachable',
      ) ||
      errorMessage.includes(
        'database server is unreachable',
      ) ||
      (
        errorMessage.includes(
          'econnrefused',
        ) &&
        errorMessage.includes(
          'postgres',
        )
      ) ||
      errorMessage.includes(
        'eai_again postgres',
      ) ||
      errorMessage.includes(
        'enotfound postgres',
      )
    );
  }
}