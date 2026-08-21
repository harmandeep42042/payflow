import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const port = Number(process.env.REWARD_SERVICE_PORT || 4007);

  await app.listen(port, '0.0.0.0');

  Logger.log(
    `Reward Service running on http://localhost:${port}`,
    'Bootstrap',
  );
}

bootstrap();
