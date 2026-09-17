import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './prisma-client';

/**
 * Prisma 7 talks to Postgres through a driver adapter (node-postgres) instead
 * of a Rust engine. Two things follow from that:
 *
 *  1. There is no engine binary to download or ship.
 *  2. `?schema=auth` in the connection string is a PRISMA-specific parameter.
 *     node-postgres ignores it, so without the explicit `schema` option below
 *     every query would silently run against `public` instead of `auth`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg(
        { connectionString: config.getOrThrow<string>('AUTH_DATABASE_URL') },
        { schema: 'auth' },
      ),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to the auth schema');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
