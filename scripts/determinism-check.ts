/**
 * Measures how consistently classify() assigns a grade to the same question.
 * Run: node --env-file=.env.local --import tsx scripts/determinism-check.ts [modelId] [runs] [samplesPerCall]
 */
import { classify } from '../src/server/ai/classify';
import { CLASSIFY_MODEL_ID } from '../src/server/ai/model';
import { SAMPLE_QUESTIONS } from './sample-questions';

const modelId = process.argv[2] ?? CLASSIFY_MODEL_ID;
const runs = Number(process.argv[3] ?? 5);
const samples = process.argv[4] ? Number(process.argv[4]) : undefined;

async function main() {
  console.log(`model=${modelId} runs=${runs} samplesPerCall=${samples ?? 'default'}`);
  const summary: Array<{ label: string; expected: number; grades: string; teks: string; avgMs: number }> = [];

  for (const q of SAMPLE_QUESTIONS) {
    const results = await Promise.all(
      Array.from({ length: runs }, () =>
        classify({ kind: 'text', text: q.text }, modelId, samples),
      ),
    );
    const grades: Record<string, number> = {};
    const teks: Record<string, number> = {};
    for (const r of results) {
      const g = String(r.classification.gradeLevel);
      grades[g] = (grades[g] ?? 0) + 1;
      const t = r.classification.teksStandard;
      teks[t] = (teks[t] ?? 0) + 1;
    }
    const avgMs = Math.round(results.reduce((a, r) => a + r.latencyMs, 0) / results.length);
    summary.push({ label: q.label, expected: q.expectedGrade, grades: JSON.stringify(grades), teks: JSON.stringify(teks), avgMs });

    const off = results.filter((r) => r.classification.gradeLevel !== q.expectedGrade);
    for (const r of off.slice(0, 2)) {
      console.log(`[${q.label}] off-grade ${r.classification.gradeLevel} (${r.classification.teksStandard}): ${r.classification.reasoning}`);
    }
  }

  console.table(summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
