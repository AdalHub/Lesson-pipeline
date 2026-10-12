/** Explicit snapshot/delete/restore workflow. No TRUNCATE; new arrivals survive. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inArray } from 'drizzle-orm';
import { db, pool } from '../src/server/db';
import { submissions, classifications, lessons } from '../src/server/db/schema';

async function main() {
  const mode = process.argv[2] ?? 'inspect';
  const host = new URL(process.env.DATABASE_URL!).hostname;
  if (mode === 'inspect') {
    const rows = await db.query.submissions.findMany({
      columns: { id: true, inputType: true, rawText: true, createdAt: true },
      with: { classifications: { columns: { gradeLevel: true, subject: true, teksStandard: true } }, lessons: { columns: { title: true } } },
    });
    console.log(JSON.stringify({ host, count: rows.length, rows }, null, 2));
    return;
  }
  const root = path.resolve('backups');
  fs.mkdirSync(root, { recursive: true });
  if (mode === 'snapshot') {
    const selectedIds = process.argv.slice(3);
    assert(selectedIds.every(value => /^[0-9a-f-]{36}$/.test(value)), 'Invalid snapshot ID');
    const rows = await db.transaction(async tx => ({
      submissions: await tx.select().from(submissions).where(selectedIds.length ? inArray(submissions.id, selectedIds) : undefined),
      classifications: await tx.select().from(classifications).where(selectedIds.length ? inArray(classifications.submissionId, selectedIds) : undefined),
      lessons: await tx.select().from(lessons).where(selectedIds.length ? inArray(lessons.submissionId, selectedIds) : undefined),
    }), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    const file = path.join(root, `demos-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({ host, capturedAt: new Date().toISOString(), ...rows }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ file, submissions: rows.submissions.length, classifications: rows.classifications.length, lessons: rows.lessons.length }));
    return;
  }
  assert(['delete-snapshot', 'restore'].includes(mode), 'Unknown mode');
  const file = path.resolve(process.argv[3] ?? '');
  assert(file.startsWith(root + path.sep) && file.endsWith('.json'), 'Use an exact backup path inside backups/');
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(backup.host, host, 'Backup belongs to another database');
  const ids: string[] = backup.submissions.map((row: { id: string }) => row.id);
  assert(ids.length > 0 && ids.every(value => /^[0-9a-f-]{36}$/.test(value)));
  if (mode === 'delete-snapshot') {
    const deleted = await db.transaction(async tx => tx.delete(submissions).where(inArray(submissions.id, ids)).returning({ id: submissions.id }));
    console.log(`Removed ${deleted.length} snapshotted submissions and their cascading outputs. Recoverable from ${file}.`);
  } else {
    const dates = (rows: Array<Record<string, unknown>>) => rows.map(row => ({ ...row, createdAt: new Date(String(row.createdAt)) }));
    await db.transaction(async tx => {
      await tx.insert(submissions).values(dates(backup.submissions) as typeof submissions.$inferInsert[]).onConflictDoNothing();
      if (backup.classifications.length) await tx.insert(classifications).values(dates(backup.classifications) as typeof classifications.$inferInsert[]).onConflictDoNothing();
      if (backup.lessons.length) await tx.insert(lessons).values(dates(backup.lessons) as typeof lessons.$inferInsert[]).onConflictDoNothing();
    });
    console.log(`Restored backup records idempotently from ${file}.`);
  }
}
main().catch(() => { console.error('Demo maintenance failed; no credentials logged.'); process.exitCode = 1; }).finally(() => pool.end());
