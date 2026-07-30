import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;

  await app.listen(port);

  Logger.log(
    `API Gateway is running at http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
