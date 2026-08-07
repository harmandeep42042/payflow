import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import {
  AppModule,
} from './app/app.module';

async function bootstrap():
  Promise<void> {
  const app =
    await NestFactory.create(
      AppModule,
    );

  app.setGlobalPrefix(
    'api/v1',
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig =
    new DocumentBuilder()
      .setTitle(
        'Payflow Payment Service API',
      )
      .setDescription(
        'Payment order and provider integration service',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
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
  );

  const port =
    Number(
      process.env
        .PAYMENT_SERVICE_PORT,
    ) || 4005;

  await app.listen(port);

  Logger.log(
    `Payment Service running on http://localhost:${port}/api/v1`,
  );

  Logger.log(
    `Swagger UI: http://localhost:${port}/swagger`,
  );
}

bootstrap();