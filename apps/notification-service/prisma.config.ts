import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads .env by itself, and ours lives at the repo root.
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

/**
 * Replaces the old `package.json#prisma` block, which Prisma 7 removed.
 * Everything the CLI needs for THIS service lives here.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'ts-node -P tsconfig.seed.json prisma/seed.ts',
  },
  datasource: {
    // Ends in ?schema=notify - the CLI honours it when running migrations.
    // At runtime the driver adapter does not, so PrismaService passes the
    // schema name explicitly. See src/prisma/prisma.service.ts.
    url: env('NOTIFY_DATABASE_URL'),
  },
});
