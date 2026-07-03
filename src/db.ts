import { PrismaClient } from '../generated/client/client';
import { PrismaBunSqlite } from 'prisma-adapter-bun-sqlite';

const adapter = new PrismaBunSqlite({ url: 'file:./prisma/dev.db' });
export const prisma = new PrismaClient({ adapter });
