/**
 * Milestone 5 smoke test: feed a classification into call 2 and print a lesson.
 * Run: npm run smoke:generate
 *
 * Generates two lessons (grade 2 and grade 10) so the reading-level difference
 * is visible side by side.
 */
import { classify } from '../src/server/ai/classify';
import { generateLesson } from '../src/server/ai/generate';
import { SAMPLE_QUESTIONS } from './sample-questions';

async function run(label: string, text: string) {
  console.log(`\n\n################ ${label} ################`);
  console.log(text);

  const c = await classify({ kind: 'text', text });
  console.log(`\n--- classification [${c.model}, ${c.latencyMs}ms] ---`);
  console.log(JSON.stringify(c.classification, null, 2));

  const g = await generateLesson({
    question: { kind: 'text', text },
    classification: c.classification,
  });
  console.log(`\n--- lesson [${g.model}, ${g.latencyMs}ms] ---`);
  console.log(JSON.stringify(g.lesson, null, 2));
}

async function main() {
  const only = process.argv[2];
  const picks = only
    ? SAMPLE_QUESTIONS.filter((q) => q.label.includes(only))
    : [SAMPLE_QUESTIONS[0]!, SAMPLE_QUESTIONS[4]!];

  for (const q of picks) {
    await run(q.label, q.text);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
