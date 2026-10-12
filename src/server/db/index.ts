import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// pg currently treats Neon's sslmode=require as verify-full, but that alias is
// changing in pg v9. Make the intended certificate + hostname verification
// explicit now and avoid the runtime security warning.
const verifiedConnectionString = connectionString.replace(
  /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/,
  '$1sslmode=verify-full',
);

// Reuse the pool across hot reloads in dev so we don't leak connections.
const globalForDb = globalThis as unknown as { __lessonPipelinePool?: Pool };

const pool =
  globalForDb.__lessonPipelinePool ??
  new Pool({
    connectionString: verifiedConnectionString,
    max: 5,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__lessonPipelinePool = pool;
}

export { pool };
export const db = drizzle(pool, { schema });
export type Db = typeof db;
