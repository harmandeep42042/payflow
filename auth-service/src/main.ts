import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app
    .getHttpAdapter()
    .getInstance()
    .disable('x-powered-by');

  app.setGlobalPrefix('api');



  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(
    new AllExceptionsFilter(),
  );

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Payflow Auth Service')
      .setDescription(
        'Authentication, JWT, refresh token and RBAC APIs',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      )
      .build();
  
    const swaggerDocument =
      SwaggerModule.createDocument(
        app,
        swaggerConfig,
      );
  
    SwaggerModule.setup(
      'swagger',
      app,
      swaggerDocument,
      {
        swaggerOptions: {
          persistAuthorization: true,
        },
      },
    );
  }

  const port = Number(
    process.env.PORT ?? 4002,
  );

  await app.listen(port);

  Logger.log(
    `Auth Service running on http://localhost:${port}/api`,
  );

  Logger.log(
    `Swagger available at http://localhost:${port}/swagger`,
  );
}

void bootstrap();