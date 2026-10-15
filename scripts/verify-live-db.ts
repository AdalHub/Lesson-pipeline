/** Read-only acceptance checks against the configured DB. */
import assert from 'node:assert/strict';
import { db, pool } from '../src/server/db';
import { teksStandards } from '../src/server/db/schema';
import { ClassificationSchema, StoredLessonSchema } from '../src/server/ai/schemas';

async function main() {
  const standards = await db.select().from(teksStandards);
  const rows = await db.query.submissions.findMany({ with: { classifications: true, lessons: true } });
  const subjects: Record<string, number> = {};
  for (const standard of standards) subjects[standard.subject] = (subjects[standard.subject] ?? 0) + 1;
  for (const row of rows) {
    assert.equal(row.classifications.length, 1, `${row.id}: classification missing or duplicated`);
    assert.equal(row.lessons.length, 1, `${row.id}: lesson missing or duplicated`);
    const c = row.classifications[0];
    const l = row.lessons[0];
    ClassificationSchema.parse(c);
    StoredLessonSchema.parse(l.content);
    assert(c.model && l.model);
    assert(c.latencyMs >= 0 && l.latencyMs >= 0);
    assert.equal(l.classificationId, c.id);
    const standard = standards.find(s => s.code === c.teksStandard && s.subject === c.subject);
    assert(standard, `${row.id}: missing catalog standard`);
    assert.equal(standard.gradeLevel, c.gradeLevel);
  }
  console.log(JSON.stringify({ standards: standards.length, subjects, completeDemoTriplets: rows.length, demos: rows.map(row => ({ id: row.id, title: row.lessons[0].title, subject: row.classifications[0].subject, grade: row.classifications[0].gradeLevel, code: row.classifications[0].teksStandard, confidence: row.classifications[0].gradeLevelConfidence })) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
