import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import {
  createProxyMiddleware,
} from 'http-proxy-middleware';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const notificationServiceUrl =
    process.env.NOTIFICATION_SERVICE_URL ??
    'http://notification-service:4006';

  const notificationSocketProxy =
    createProxyMiddleware({
      pathFilter: '/socket.io',
      target: notificationServiceUrl,
      changeOrigin: true,
      ws: true,
    });

  app
    .getHttpAdapter()
    .getInstance()
    .use(notificationSocketProxy);

  app
    .getHttpServer()
    .on(
      'upgrade',
      notificationSocketProxy.upgrade,
    );

  app.use(helmet());
  app
    .getHttpAdapter()
    .getInstance()
    .disable('x-powered-by');

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const allowedOrigins = (
    process.env.CORS_ALLOWED_ORIGINS ??
    'http://localhost:3000,http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin,
      callback,
    ) => {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          'Origin is not allowed by CORS policy',
        ),
        false,
      );
    },
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig =
      new DocumentBuilder()
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
  }

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
