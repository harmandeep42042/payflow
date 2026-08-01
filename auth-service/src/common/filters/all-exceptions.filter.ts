import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { Request, Response } from 'express';

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
}