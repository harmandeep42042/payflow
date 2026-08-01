import { Injectable } from '@nestjs/common';
import { PrismaService } from '@payflow/database';

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async getPendingEvents() {
    return this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 20,
    });
  }

  async markPublished(id: string) {
    return this.prisma.outboxEvent.update({
      where: {
        id,
      },
      data: {
        status: 'PUBLISHED',
      },
    });
  }
}