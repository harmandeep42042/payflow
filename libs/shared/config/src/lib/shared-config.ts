export type PayflowEnvironment =
  | 'development'
  | 'test'
  | 'production';

function getString(
  name: string,
  fallback: string,
): string {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  return value;
}

function getNumber(
  name: string,
  fallback: number,
): number {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

export const payflowConfig = {
  environment:
    getString(
      'NODE_ENV',
      'development',
    ) as PayflowEnvironment,

  ports: {
    apiGateway:
      getNumber(
        'API_GATEWAY_PORT',
        4000,
      ),

    walletService:
      getNumber(
        'WALLET_SERVICE_PORT',
        4001,
      ),

    authService:
      getNumber(
        'AUTH_SERVICE_PORT',
        4002,
      ),

    notificationService:
      getNumber(
        'NOTIFICATION_SERVICE_PORT',
        4003,
      ),

    adminWeb:
      getNumber(
        'ADMIN_WEB_PORT',
        3001,
      ),
  },

  urls: {
    apiGateway:
      getString(
        'API_GATEWAY_URL',
        'http://localhost:4000/api/v1',
      ),

    walletService:
      getString(
        'WALLET_SERVICE_URL',
        'http://localhost:4001/api/v1',
      ),

    authService:
      getString(
        'AUTH_SERVICE_URL',
        'http://localhost:4002/api',
      ),

    redis:
      getString(
        'REDIS_URL',
        'redis://localhost:6379',
      ),

    rabbitMq:
      getString(
        'RABBITMQ_URL',
        'amqp://payflow:payflow_password@localhost:5672',
      ),
  },

  rabbitMq: {
    walletEventsQueue:
      getString(
        'RABBITMQ_QUEUE',
        'wallet_events',
      ),

    prefetchCount:
      getNumber(
        'RABBITMQ_PREFETCH_COUNT',
        10,
      ),
  },

  auth: {
    jwtSecret:
      getString(
        'JWT_SECRET',
        'development-secret-change-me',
      ),

    accessTokenExpiresIn:
      getString(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ),

    refreshTokenExpiresIn:
      getString(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ),
  },

  email: {
    host:
      getString(
        'SMTP_HOST',
        '',
      ),

    port:
      getNumber(
        'SMTP_PORT',
        587,
      ),

    secure:
      getString(
        'SMTP_SECURE',
        'false',
      ) === 'true',

    user:
      getString(
        'SMTP_USER',
        '',
      ),

    password:
      getString(
        'SMTP_PASSWORD',
        '',
      ),

    from:
      getString(
        'SMTP_FROM',
        'Payflow <no-reply@payflow.local>',
      ),

    previewMode:
      getString(
        'EMAIL_PREVIEW_MODE',
        'true',
      ) === 'true',

    testRecipient:
      getString(
        'EMAIL_TEST_RECIPIENT',
        '',
      ),
  },

  razorpay: {
    keyId:
      getString(
        'RAZORPAY_KEY_ID',
        '',
      ),

    keySecret:
      getString(
        'RAZORPAY_KEY_SECRET',
        '',
      ),

    webhookSecret:
      getString(
        'RAZORPAY_WEBHOOK_SECRET',
        '',
      ),

    enabled:
      getString(
        'RAZORPAY_ENABLED',
        'false',
      ) === 'true',
  },

  database: {
    url:
      getString(
        'DATABASE_URL',
        '',
      ),
  },
} as const;

export type PayflowConfig =
  typeof payflowConfig;