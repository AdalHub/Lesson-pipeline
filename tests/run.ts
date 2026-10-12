// No .env file is loaded: regular tests never use production credentials or AI.
import { spawnSync } from 'node:child_process';

async function main() {
  const integration = process.argv.includes('--integration');
  const connection = integration ? process.env.TEST_DATABASE_URL : 'postgres://unused:unused@localhost:1/unit_test';
  if (!connection) throw new Error('Set TEST_DATABASE_URL to an isolated local test database.');
  if (integration) {
    const url = new URL(connection);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/lesson_pipeline_test') {
      throw new Error('Integration tests require localhost/lesson_pipeline_test; production is prohibited.');
    }
    process.env.DATABASE_URL = connection;
    const { db, pool } = await import('../src/server/db');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(db, { migrationsFolder: './drizzle' });
    await pool.end();
  }
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', integration ? 'tests/pipeline.test.ts' : 'tests/unit.test.ts'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: connection, OPENAI_API_KEY: '', AI_WEB_LOOKUP: 'false' },
  });
  process.exitCode = result.status ?? 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
