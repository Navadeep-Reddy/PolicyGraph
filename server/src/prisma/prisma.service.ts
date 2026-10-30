import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// PostgreSQL is the source of truth. This service owns the single Prisma
// connection for the application. Prisma 7 connects through a driver
// adapter; the datasource URL in prisma7.config.ts only applies to
// migrations, so the adapter is configured here from DATABASE_URL.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env['DATABASE_URL'],
        // Keep one established hosted connection between user actions. The
        // driver's default idle eviction otherwise repeats the TLS handshake.
        min: 1,
        idleTimeoutMillis: 60_000,
        keepAlive: true,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
