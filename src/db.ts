import { PrismaClient, Prisma } from '../generated/client/client';
import { PrismaBunSqlite } from 'prisma-adapter-bun-sqlite';
import { runAutoMigrations } from './migrator';

// Override Decimal serialization globally to serialize Decimals as numbers in JSON
if (Prisma && Prisma.Decimal) {
  Prisma.Decimal.prototype.toJSON = function() {
    return this.toNumber();
  };
}

// Auto-run embedded SQLite migrations to ensure schema and seed are ready before any query
await runAutoMigrations();

const adapter = new PrismaBunSqlite({ url: 'file:./prisma/dev.db' });
export const prisma = new PrismaClient({ adapter });
