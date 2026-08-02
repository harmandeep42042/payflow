import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig =
    new DocumentBuilder()
      .setTitle('Payflow Wallet Service API')
      .setDescription(
        'Enterprise Wallet Microservice',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Enter JWT access token',
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
  );

  const port =
    Number(process.env.PORT) || 4001;

  await app.listen(port);

  console.log(
    `🚀 Wallet Service running on http://localhost:${port}`,
  );

  console.log(
    `📘 Swagger UI: http://localhost:${port}/swagger`,
  );
}

bootstrap();