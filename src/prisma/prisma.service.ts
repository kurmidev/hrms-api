import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase() is not allowed in production');
    }
    const tableNames = await this.$queryRaw<{ TABLE_NAME: string }[]>`
      SELECT TABLE_NAME FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND TABLE_NAME != '_prisma_migrations'
    `;
    for (const { TABLE_NAME } of tableNames) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
    }
  }
}
