import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Payflow API Gateway')
    .setDescription(
      'Enterprise API Gateway for Payflow Microservices',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  SwaggerModule.setup(
    'swagger',
    app,
    swaggerDocument,
  );

  const port = Number(
    process.env.API_GATEWAY_PORT ?? 4000,
  );

  await app.listen(port);

  Logger.log(
    `🚀 API Gateway running at http://localhost:${port}/api/v1`,
  );

  Logger.log(
    `📘 Swagger UI available at http://localhost:${port}/swagger`,
  );
}

bootstrap();