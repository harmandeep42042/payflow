import {
  Global,
  Logger,
  Module,
} from '@nestjs/common';
import {
  createClient,
  RedisClientType,
} from 'redis';

import { REDIS_CLIENT } from './redis.constants';
import { RedisController } from './redis.controller';
import { RedisService } from './redis.service';

@Global()
@Module({
  controllers: [RedisController],

  providers: [
    {
      provide: REDIS_CLIENT,

      useFactory: async (): Promise<RedisClientType> => {
        const logger = new Logger('RedisClient');

        const client = createClient({
          url:
            process.env.REDIS_URL ??
            'redis://localhost:6379',
        });

        client.on('error', (error: Error) => {
          logger.error(
            `Redis error: ${error.message}`,
          );
        });

        client.on('reconnecting', () => {
          logger.warn('Redis reconnecting...');
        });

        await client.connect();

        logger.log('Connected to Redis');

        return client as RedisClientType;
      },
    },

    RedisService,
  ],

  exports: [
    REDIS_CLIENT,
    RedisService,
  ],
})
export class RedisModule {}
