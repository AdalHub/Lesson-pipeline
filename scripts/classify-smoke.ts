/**
 * Milestone 4 smoke test: classify real questions from different grades.
 * Run: npm run smoke:classify
 */
import { classify } from '../src/server/ai/classify';
import { SAMPLE_QUESTIONS } from './sample-questions';

async function main() {
  const results: Array<{ label: string; expected: number; got: number; teks: string; latencyMs: number }> = [];

  for (const q of SAMPLE_QUESTIONS) {
    console.log(`\n=== ${q.label} ===`);
    console.log(q.text);
    const r = await classify({ kind: 'text', text: q.text });
    console.log(`\n[model=${r.model} latency=${r.latencyMs}ms]`);
    console.log(JSON.stringify(r.classification, null, 2));
    results.push({
      label: q.label,
      expected: q.expectedGrade,
      got: r.classification.gradeLevel,
      teks: r.classification.teksStandard,
      latencyMs: r.latencyMs,
    });
  }

  // Determinism check: classify the grade-3 question a second time.
  const again = await classify({ kind: 'text', text: SAMPLE_QUESTIONS[1]!.text });
  console.log('\n=== determinism: grade 3 question, second run ===');
  console.log(
    `grade=${again.classification.gradeLevel} teks=${again.classification.teksStandard} (first run: grade=${results[1]!.got} teks=${results[1]!.teks})`,
  );

  console.log('\n=== summary ===');
  console.table(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
