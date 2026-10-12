import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from '../src/server/db';
import { submissions } from '../src/server/db/schema';
import { createLessonRouter } from '../src/server/api/routers/lesson';
import { PipelineError } from '../src/server/api/pipeline-error';
import { TRPCError } from '@trpc/server';
import { classification, lesson } from './fixtures';

// The launcher refuses production URLs, and this guard also prevents direct misuse.
const url = new URL(process.env.DATABASE_URL!);
assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname === '/lesson_pipeline_test');
const ids: string[] = [];
const id = () => { const value = randomUUID(); ids.push(value); return value; };
const providers = {
  classify: async () => ({ classification: { ...classification }, model: 'fake-classifier', latencyMs: 10, rawResponse: { test: true } }),
  generateLesson: async () => ({ lesson, model: 'fake-generator', latencyMs: 20, rawResponse: null }),
};
const caller = (overrides = {}) => createLessonRouter({ ...providers, ...overrides }).createCaller({ db, headers: new Headers() });
after(async () => {
  if (ids.length) await db.delete(submissions).where(inArray(submissions.id, ids));
  await pool.end();
});

for (const inputType of ['text', 'image'] as const) test(`${inputType} pipeline persists all stages and passes classification to generator`, async () => {
  let called = false;
  const api = caller({ generateLesson: async (input: { classification: unknown; question: { kind: string } }) => {
    assert.deepEqual(input.classification, classification);
    assert.equal(input.question.kind, inputType);
    called = true;
    return providers.generateLesson();
  } });
  const submissionId = id();
  const result = await api.generate(inputType === 'text'
    ? { submissionId, inputType, text: '12 + 24' }
    : { submissionId, inputType, imageDataUrl: 'data:image/png;base64,AAAA' });
  assert(called);
  const saved = await api.getById({ id: submissionId });
  assert.equal(saved.lesson?.id, result.lesson.id);
  assert.equal(saved.lesson?.classificationId, saved.classification?.id);
  assert.equal(saved.classification?.model, 'fake-classifier');
  assert.equal(saved.lesson?.latencyMs, 20);
  assert.deepEqual(saved.lesson?.content, lesson);
});

for (const stage of ['classify', 'generate'] as const) test(`${stage} failure preserves completed stages`, async () => {
  const submissionId = id();
  const fail = async () => { throw new Error('Injected provider outage'); };
  const api = caller(stage === 'classify' ? { classify: fail } : { generateLesson: fail });
  await assert.rejects(api.generate({ submissionId, inputType: 'text', text: '12 + 24' }), error => {
    assert(error instanceof TRPCError);
    assert(error.cause instanceof PipelineError);
    assert.equal(error.cause.stage, stage);
    assert.equal(error.cause.submissionId, submissionId);
    return true;
  });
  const saved = await api.getById({ id: submissionId });
  assert.equal(saved.submission.id, submissionId);
  assert.equal(saved.lesson, null);
  assert.equal(saved.classification !== null, stage === 'generate');
});

test('bad input is rejected before saving or calling AI', async () => {
  const submissionId = id();
  const api = caller({ classify: async () => { assert.fail('AI must not run'); } });
  await assert.rejects(api.generate({ submissionId, inputType: 'text', text: ' ' }), { code: 'BAD_REQUEST' });
  assert.equal(await db.query.submissions.findFirst({ where: eq(submissions.id, submissionId) }), undefined);
});

test('invalid provider output fails closed and keeps original submission', async () => {
  const submissionId = id();
  const api = caller({ classify: async () => ({ ...(await providers.classify()), classification: { ...classification, gradeLevel: 99 } }) });
  await assert.rejects(api.generate({ submissionId, inputType: 'text', text: '12 + 24' }), { code: 'INTERNAL_SERVER_ERROR' });
  assert.equal((await api.getById({ id: submissionId })).classification, null);
});

test('missing lesson returns typed NOT_FOUND', async () => {
  await assert.rejects(caller().getById({ id: randomUUID() }), { code: 'NOT_FOUND' });
});

test('history pagination has no duplicate or missing rows when timestamps tie', async () => {
  const fixed = new Date('2099-01-01T00:00:00Z');
  const newIds = [id(), id(), id()];
  await db.insert(submissions).values(newIds.map(value => ({ id: value, inputType: 'text' as const, rawText: 'Pagination fixture', createdAt: fixed })));
  const api = caller();
  const first = await api.list({ limit: 2 });
  assert(first.nextCursor);
  const next = await api.list({ limit: 2, cursor: first.nextCursor });
  const seen = [...first.items, ...next.items].map(r => r.id);
  assert.equal(new Set(seen).size, seen.length);
  assert(newIds.every(value => seen.includes(value)));
});
