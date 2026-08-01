import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@payflow/database';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getData() {
    try {
      // Database par real query run karke connection verify karega.
      await this.prisma.user.count();

      return {
        status: 'ok',
        service: 'wallet-service',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown database error';

      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(`Database health check failed: ${message}`, stack);

      throw new ServiceUnavailableException({
        status: 'error',
        service: 'wallet-service',
        database: 'disconnected',
      });
    }
  }
}