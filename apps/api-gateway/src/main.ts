import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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

  const port = Number(
    process.env.API_GATEWAY_PORT ?? 4000,
  );

  await app.listen(port);

  Logger.log(
    `API Gateway is running at http://localhost:${port}/api/v1`,
  );
}

bootstrap();