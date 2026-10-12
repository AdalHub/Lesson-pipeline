import assert from 'node:assert/strict';
import { z } from 'zod';
import snapshot from '../data/teks-expanded.json';
import { db, pool } from '../src/server/db';
import { teksStandards } from '../src/server/db/schema';

export const StandardSchema = z.object({
  code: z.string().regex(/^[1-5]\.\d+[A-Z]$/),
  subject: z.enum(['reading_language_arts', 'social_studies']),
  gradeLevel: z.number().int().min(1).max(5),
  course: z.null(), knowledgeAndSkills: z.string().min(10),
  studentExpectation: z.string().min(8), description: z.string().min(8),
  effectiveVersion: z.string().min(10),
  sourceUrl: z.enum([
    'https://tea.texas.gov/laws-and-rules/sboe-rules-tac/sboe-tac-currently-effect/ch110a.pdf',
    'https://tea.texas.gov/laws-and-rules/sboe-rules-tac/sboe-tac-currently-effect/ch113a.pdf',
  ]),
  sourceKind: z.literal('official'), searchText: z.string().min(10),
});

async function main() {
  const records = z.array(StandardSchema).parse(snapshot.standards);
  assert.equal(new Set(records.map(r => `${r.subject}:${r.code}`)).size, records.length);
  assert.equal(snapshot.sources.reduce((sum, s) => sum + s.records, 0), records.length);
  await db.transaction(async tx => {
    for (let i = 0; i < records.length; i += 100) {
      await tx.insert(teksStandards).values(records.slice(i, i + 100)).onConflictDoNothing();
    }
  });
  console.log(`Validated and imported ${records.length} official expectations (idempotent).`);
}
main().catch(() => { console.error('TEKS import failed; transaction rolled back.'); process.exitCode = 1; }).finally(() => pool.end());
