/**
 * Milestone 6 smoke test: run lesson.generate end to end through the tRPC
 * caller, then read all three rows back from Postgres.
 *
 * Run: npm run smoke:pipeline
 * Failure path (classification model that does not exist):
 *   AI_CLASSIFY_MODEL=no-such-model node --env-file=.env.local --import tsx scripts/pipeline-smoke.ts fail
 */
import { TRPCError } from '@trpc/server';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { createCaller } from '../src/server/api/root';
import { PipelineError } from '../src/server/api/pipeline-error';
import { createTRPCContext } from '../src/server/api/trpc';
import { db, pool } from '../src/server/db';
import { classifications, lessons, submissions } from '../src/server/db/schema';
import { SAMPLE_QUESTIONS } from './sample-questions';

const mode = process.argv[2] ?? 'ok';

async function showRows(submissionId: string) {
  const [sub] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId));
  const cls = await db
    .select({
      id: classifications.id,
      submissionId: classifications.submissionId,
      gradeLevel: classifications.gradeLevel,
      gradeLevelConfidence: classifications.gradeLevelConfidence,
      subject: classifications.subject,
      teksStandard: classifications.teksStandard,
      questionType: classifications.questionType,
      difficulty: classifications.difficulty,
      keyConcepts: classifications.keyConcepts,
      model: classifications.model,
      latencyMs: classifications.latencyMs,
      createdAt: classifications.createdAt,
    })
    .from(classifications)
    .where(eq(classifications.submissionId, submissionId));
  const lsn = await db
    .select({
      id: lessons.id,
      submissionId: lessons.submissionId,
      classificationId: lessons.classificationId,
      title: lessons.title,
      model: lessons.model,
      latencyMs: lessons.latencyMs,
      createdAt: lessons.createdAt,
    })
    .from(lessons)
    .where(eq(lessons.submissionId, submissionId));

  assert(sub, 'Submission must survive');
  assert.equal(cls.length, mode === 'fail' ? 0 : 1);
  assert.equal(lsn.length, mode === 'fail' ? 0 : 1);
  if (mode !== 'fail') {
    assert.equal(lsn[0].classificationId, cls[0].id);
    assert(cls[0].model && lsn[0].model);
    assert(cls[0].latencyMs >= 0 && lsn[0].latencyMs >= 0);
  }

  console.log('\n--- submissions row ---');
  console.log(JSON.stringify(sub, null, 2));
  console.log(`\n--- classifications rows (${cls.length}) ---`);
  console.log(JSON.stringify(cls, null, 2));
  console.log(`\n--- lessons rows (${lsn.length}) ---`);
  console.log(JSON.stringify(lsn, null, 2));
}

async function main() {
  const api = createCaller(await createTRPCContext({ headers: new Headers() }));
  const q = SAMPLE_QUESTIONS[3]!;
  console.log(`mode=${mode}\nquestion: ${q.text}`);

  if (mode === 'fail') {
    try {
      await api.lesson.generate({ inputType: 'text', text: q.text });
      assert.fail('Expected classification failure; use an invalid AI_CLASSIFY_MODEL');
    } catch (err) {
      if (!(err instanceof TRPCError)) throw err;
      console.log('\n--- typed error ---');
      console.log(`code: ${err.code}`);
      console.log(`message: ${err.message}`);
      if (err.cause instanceof PipelineError) {
        assert.equal(err.cause.stage, 'classify');
        console.log(`stage: ${err.cause.stage}`);
        console.log(`submissionId: ${err.cause.submissionId}`);
        await showRows(err.cause.submissionId);
      } else {
        throw new Error('Expected a stage-aware PipelineError');
      }
    }
    return;
  }

  const started = Date.now();
  const res = await api.lesson.generate({ inputType: 'text', text: q.text });
  console.log(`\npipeline wall time: ${Date.now() - started}ms`);
  console.log(`submissionId: ${res.submissionId}`);
  console.log(`classification: grade ${res.classification.gradeLevel}, ${res.classification.subject}, TEKS ${res.classification.teksStandard} [${res.classification.model}, ${res.classification.latencyMs}ms]`);
  console.log(`lesson: "${res.lesson.title}" [${res.lesson.model}, ${res.lesson.latencyMs}ms]`);

  await showRows(res.submissionId);

  const byId = await api.lesson.getById({ id: res.submissionId });
  console.log('\n--- lesson.getById ---');
  console.log(`submission ${byId.submission.id}, classification ${byId.classification?.id}, lesson ${byId.lesson?.id}`);
  console.log(`lesson objective: ${byId.lesson?.content.objective}`);

  const list = await api.lesson.list({ limit: 3 });
  console.log('\n--- lesson.list (3 newest) ---');
  for (const item of list.items) {
    console.log(`${item.createdAt.toISOString()}  grade ${item.classification?.gradeLevel ?? '?'}  ${item.classification?.teksStandard ?? '?'}  ${item.preview}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
