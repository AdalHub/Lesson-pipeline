import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Reuse the pool across hot reloads in dev so we don't leak connections.
const globalForDb = globalThis as unknown as { __lessonPipelinePool?: Pool };

const pool =
  globalForDb.__lessonPipelinePool ??
  new Pool({
    connectionString,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__lessonPipelinePool = pool;
}

export { pool };
export const db = drizzle(pool, { schema });
export type Db = typeof db;
