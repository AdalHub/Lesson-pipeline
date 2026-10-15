import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockLanguageModelV4 } from 'ai/test';
import {
  answersNeededToPass,
  cardComplete,
  DECK_STEPS,
  initialDeckState,
  legendItems,
  makeDeckReducer,
  MAX_WRONG_PICKS,
  PASS_THRESHOLD,
  partState,
  scoreQuiz,
  splitTitle,
  strategyUnlocked,
  titleSize,
  type DeckAction,
  type DeckState,
} from '../src/lib/lesson-deck';
import { describeSchemaIssues, generateLesson, GENERATE_SYSTEM } from '../src/server/ai/generate';
import {
  lessonQualityIssues,
  needsRepair,
  normalizeLesson,
  repairNote,
  shuffleGuidedOptions,
  shuffleQuizChoices,
  type QualityContext,
} from '../src/server/ai/lesson-quality';
import {
  isSlideLesson,
  LegacyLessonSchema,
  LessonSchema,
  StoredLessonSchema,
  type Lesson,
} from '../src/server/ai/schemas';
import { classification, legacyLesson, lesson } from './fixtures';

const clone = <T>(value: T): T => structuredClone(value);
const ctx: QualityContext = { gradeLevel: 2 };
const codes = (l: Lesson, c: QualityContext = ctx) => lessonQualityIssues(l, c).map((i) => i.code);

/* ------------------------------- schema --------------------------------- */

test('slide lesson schema accepts the fixture and rejects broken structure', () => {
  assert(LessonSchema.safeParse(lesson).success);

  const noCorrect = clone(lesson);
  noCorrect.guidedPractice.options.forEach((o) => (o.correct = false));
  assert(!LessonSchema.safeParse(noCorrect).success, 'zero correct options');

  const twoCorrect = clone(lesson);
  twoCorrect.guidedPractice.options.forEach((o) => (o.correct = true));
  assert(!LessonSchema.safeParse(twoCorrect).success, 'several correct options');

  const badIndex = clone(lesson);
  badIndex.quiz.items[0]!.answerIndex = 3;
  assert(!LessonSchema.safeParse(badIndex).success, 'answerIndex outside the choices');

  const nonExampleAllHold = clone(lesson);
  nonExampleAllHold.strategy.nonExample.parts.forEach((p) => (p.holds = true));
  assert(!LessonSchema.safeParse(nonExampleAllHold).success, 'non-example that passes every part');

  const exampleFails = clone(lesson);
  exampleFails.strategy.example.parts[0]!.holds = false;
  assert(!LessonSchema.safeParse(exampleFails).success, 'example with a failing part');

  // An annotation without a matching segment is tolerated by the schema: the
  // legend skips it and the quality layer warns. It must not cost a retry.
  const orphanAnnotation = clone(lesson);
  orphanAnnotation.bigIdea.after = orphanAnnotation.bigIdea.after.filter((s) => s.role !== 'mark');
  assert(LessonSchema.safeParse(orphanAnnotation).success, 'orphan annotation is tolerated');
  assert(codes(orphanAnnotation).includes('annotation-orphan'));
  assert.deepEqual(
    legendItems(orphanAnnotation.bigIdea).map((i) => i.role),
    ['key'],
  );
  assert.deepEqual(
    legendItems(lesson.bigIdea).map((i) => [i.role, i.text]),
    [['key', '+'], ['mark', '=']],
  );
  // two annotations of one role point at successive segments of that role
  const twoKeys = clone(lesson);
  twoKeys.bigIdea.after = [
    { text: '5', role: 'key' },
    { text: 'x', role: 'plain' },
    { text: '8', role: 'key' },
    { text: '40', role: 'focus' },
  ];
  twoKeys.bigIdea.annotations = [
    { role: 'key', label: 'groups' },
    { role: 'key', label: 'in each group' },
  ];
  assert.deepEqual(legendItems(twoKeys.bigIdea).map((i) => i.text), ['5', '8']);

  const noMisconceptionItem = clone(lesson);
  noMisconceptionItem.quiz.items.forEach((i) => (i.targetsMisconception = false));
  assert(!LessonSchema.safeParse(noMisconceptionItem).success, 'no item targets the misconception');

  const threeTakeaways = clone(lesson);
  threeTakeaways.recap.takeaways.push('One more');
  assert(!LessonSchema.safeParse(threeTakeaways).success, 'recap has exactly two takeaways');
});

test('stored lessons accept either shape and the guard tells them apart', () => {
  assert(StoredLessonSchema.safeParse(lesson).success);
  assert(StoredLessonSchema.safeParse(legacyLesson).success);
  assert(LegacyLessonSchema.safeParse(legacyLesson).success);
  assert(!LessonSchema.safeParse(legacyLesson).success);
  assert.equal(isSlideLesson(lesson), true);
  assert.equal(isSlideLesson(legacyLesson), false);
  assert.equal(isSlideLesson(null), false);
});

/* ------------------------------ pedagogy -------------------------------- */

test('the fixture lesson passes every pedagogy check', () => {
  assert.deepEqual(lessonQualityIssues(lesson, ctx), []);
});

test('quality checks catch the failures a model quietly produces', () => {
  const same = clone(lesson);
  same.quiz.items.forEach((i) => (i.answerIndex = 0));
  assert(codes(same).includes('quiz-same-answer'));

  const thin = clone(lesson);
  thin.guidedPractice.options[1]!.feedback = 'Wrong.';
  assert(codes(thin).includes('feedback-thin'));

  const dupOptions = clone(lesson);
  dupOptions.guidedPractice.options[2]!.text = dupOptions.guidedPractice.options[0]!.text.toUpperCase();
  assert(codes(dupOptions).includes('options-unique'));

  const recycled = clone(lesson);
  recycled.quiz.items[0]!.prompt = recycled.guidedPractice.options[0]!.text;
  assert(codes(recycled).includes('quiz-recycles-practice'));

  const markdown = clone(lesson);
  markdown.recap.watchOut = 'Never **add** a tens digit to a ones digit.';
  assert(codes(markdown).includes('markup'));

  const emoji = clone(lesson);
  emoji.recap.takeaways[0] = 'Add tens with tens 🎉';
  assert(codes(emoji).includes('emoji'));

  const empty = clone(lesson);
  empty.title = '   ';
  assert(codes(empty).includes('empty'));

  assert(needsRepair(lessonQualityIssues(same, ctx)));
  assert.match(repairNote(lessonQualityIssues(same, ctx)), /quiz\.items/);
});

test('maths choices that differ only by operator are distinct', () => {
  const math = clone(lesson);
  math.quiz.items[0]!.choices = ['6 x 5', '6 + 5', '6 - 5'];
  math.quiz.items[0]!.answerIndex = 0;
  assert(!codes(math).includes('choices-unique'));
  math.quiz.items[0]!.choices = ['6 x 5', '6 x 5.'];
  assert(codes(math).includes('choices-unique'));
});

test('a blank written as __ is not mistaken for markdown', () => {
  const blank = clone(lesson);
  blank.guidedPractice.question = 'Which number makes 24 + __ = 59 true?';
  assert(!codes(blank).includes('markup'));
});

test('items copied from the original question are flagged, new ones are not', () => {
  const question = 'Jamal has 34 stickers. His sister gives him 25 more. How many stickers now?';
  const copied = clone(lesson);
  copied.guidedPractice.question = question;
  assert(codes(copied, { gradeLevel: 2, question }).includes('reuses-question'));
  assert(!codes(lesson, { gradeLevel: 2, question }).includes('reuses-question'));
});

test('advisory checks warn but never request a repair', () => {
  const l = clone(lesson);
  l.objective = 'Add two-digit numbers.';
  l.plan.successCriteria[0] = 'Find tens and ones.';
  l.recap.watchOut = 'Be careful out there.';
  l.keyTerms = ['adding two digit numbers', 'tens and ones'];
  l.teach.cases.forEach((c) => (c.holds = false));
  l.bigIdea.after = [
    { text: '34', role: 'plain' },
    { text: 'plus', role: 'key' },
    { text: '25', role: 'plain' },
    { text: 'equals', role: 'mark' },
    { text: '59', role: 'focus' },
  ];
  l.bigIdea.before = ['34 plus', 'a number'];
  const issues = lessonQualityIssues(l, ctx);
  for (const code of [
    'objective-voice',
    'criteria-voice',
    'misconception-echo',
    'key-terms-long',
    'teach-no-instance',
    'before-reveals',
  ]) {
    assert(issues.some((i) => i.code === code && i.level === 'warn'), `expected warning ${code}`);
  }
  assert(!needsRepair(issues));
});

test('a contrasting teach case is allowed and a joining word on the "before" card is noticed', () => {
  const contrast = clone(lesson);
  contrast.teach.cases[1]!.holds = false;
  assert.deepEqual(lessonQualityIssues(contrast, ctx), []);

  const ela = clone(lesson);
  ela.bigIdea.before = ['We played soccer', 'and the rain began.'];
  ela.bigIdea.after = [
    { text: 'We played soccer', role: 'plain' },
    { text: ',', role: 'mark' },
    { text: 'and', role: 'key' },
    { text: 'the rain began.', role: 'plain' },
  ];
  assert(lessonQualityIssues(ela, ctx).some((i) => i.code === 'before-reveals'));

  // "and" inside another word is not a match
  ela.bigIdea.before = ['The band played', 'Sandy listened.'];
  assert(!lessonQualityIssues(ela, ctx).some((i) => i.code === 'before-reveals'));
});

test('reading level warns on dense text for young grades but not older ones', () => {
  const dense = clone(lesson);
  const long =
    'When you want to find the total of two numbers that each have tens and ones you should always remember to line them up carefully first.';
  dense.guidedPractice.reminder = long;
  dense.recap.takeaways = [long, long];
  assert(codes(dense, { gradeLevel: 2 }).includes('reading-level'));
  assert(!codes(dense, { gradeLevel: 11 }).includes('reading-level'));
});

test('shuffling keeps the options and the single correct answer, and does not mutate', () => {
  const before = clone(lesson);
  const shuffled = shuffleGuidedOptions(lesson, () => 0);
  assert.deepEqual(lesson, before);
  assert.equal(shuffled.guidedPractice.options.length, 3);
  assert.equal(shuffled.guidedPractice.options.filter((o) => o.correct).length, 1);
  assert.deepEqual(
    [...shuffled.guidedPractice.options].map((o) => o.text).sort(),
    [...lesson.guidedPractice.options].map((o) => o.text).sort(),
  );
  assert(LessonSchema.safeParse(shuffled).success);
});

test('phrase-length quiz choices are shuffled with the answer following; short pairs are not', () => {
  const mc = clone(lesson);
  mc.quiz.items[0] = {
    prompt: 'Which is a compound sentence?',
    choices: ['We ate pizza and salad.', 'We ate pizza, and we watched TV.', 'We ate and ran.'],
    answerIndex: 1,
    explanation: 'Both halves are whole sentences.',
    targetsMisconception: false,
  };
  const correctText = mc.quiz.items[0]!.choices[1];
  const rotated = shuffleQuizChoices(mc, () => 0);
  const item = rotated.quiz.items[0]!;
  assert.equal(item.choices[item.answerIndex], correctText, 'the answer moves with its text');
  assert.notEqual(item.answerIndex, 1, 'position changed');
  assert(LessonSchema.safeParse(rotated).success);
  // "Compound" / "Not" style pairs keep their order
  assert.deepEqual(rotated.quiz.items[1]!.choices, mc.quiz.items[1]!.choices);
  assert.equal(rotated.quiz.items[1]!.answerIndex, mc.quiz.items[1]!.answerIndex);
  // never mutates its input
  assert.equal(mc.quiz.items[0]!.answerIndex, 1);
  assert(LessonSchema.safeParse(normalizeLesson(mc)).success);
});

test('a repeated stem with different choices is not a duplicate; identical items are', () => {
  const l = clone(lesson);
  l.quiz.items[0] = {
    ...l.quiz.items[0]!,
    prompt: 'Which is a compound sentence?',
    choices: ['We ran and jumped.', 'We ran, and we jumped.'],
    answerIndex: 1,
  };
  l.quiz.items[1] = {
    ...l.quiz.items[1]!,
    prompt: 'Which is a compound sentence?',
    choices: ['Mom sang and danced.', 'Mom sang, and Dad danced.'],
    answerIndex: 1,
  };
  assert(!codes(l).includes('quiz-duplicate'));
  l.quiz.items[1] = { ...l.quiz.items[0]! };
  assert(codes(l).includes('quiz-duplicate'));
});

test('a shared question stem is a warning, a copied item is a fix', () => {
  const question =
    'Which sentence is a compound sentence? A) We sold lemonade and counted the coins. B) We sold lemonade, and the cups ran out.';
  const stem = clone(lesson);
  stem.guidedPractice.question = 'Which sentence is a compound sentence?';
  const stemIssues = lessonQualityIssues(stem, { gradeLevel: 3, question });
  assert(stemIssues.some((i) => i.code === 'echoes-question' && i.level === 'warn'));
  assert(!needsRepair(stemIssues), 'a shared stem must not cost a regeneration');

  const copied = clone(lesson);
  copied.guidedPractice.question = question;
  assert(needsRepair(lessonQualityIssues(copied, { gradeLevel: 3, question })));
});

test('the lesson prompt keeps the principles the schema depends on', () => {
  for (const phrase of [
    'WRITE THE PLAN FIRST',
    'CONCRETE BEFORE ABSTRACT',
    'ELABORATED FEEDBACK',
    'INDEPENDENT RETRIEVAL',
    'misconception',
    'NEW items',
  ]) {
    assert(GENERATE_SYSTEM.includes(phrase), `prompt lost: ${phrase}`);
  }
});

/* ---------------------------- deck mechanics ---------------------------- */

test('the deck lists the reference steps in teaching order', () => {
  assert.deepEqual(
    DECK_STEPS.map((s) => s.id),
    ['title', 'bigIdea', 'teach', 'strategy', 'practice', 'quiz', 'recap'],
  );
});

test('quiz scoring uses the 80% mastery threshold and counts blanks as wrong', () => {
  const items = [{ answerIndex: 0 }, { answerIndex: 1 }, { answerIndex: 0 }];
  assert.equal(PASS_THRESHOLD, 0.8);
  assert.equal(scoreQuiz([0, 1, 0], items).passed, true);
  const two = scoreQuiz([0, 1, 1], items);
  assert.equal(two.correct, 2);
  assert.equal(two.passed, false);
  assert.equal(answersNeededToPass(two), 1);
  assert.equal(scoreQuiz([0, null, 0], items).perItem[1], false);
  assert.equal(scoreQuiz([], []).passed, false);

  const five = Array.from({ length: 5 }, () => ({ answerIndex: 0 }));
  assert.equal(scoreQuiz([0, 0, 0, 0, 1], five).passed, true, '4 of 5 is 80%');
  assert.equal(scoreQuiz([0, 0, 0, 1, 1], five).passed, false);
});

test('title helpers split the accent word and shrink long titles', () => {
  assert.deepEqual(splitTitle('Sentence Power!'), { head: 'Sentence', tail: 'Power!' });
  assert.deepEqual(splitTitle('Fractions'), { head: '', tail: 'Fractions' });
  assert.equal(titleSize('Sentence Power!'), 'slide-display');
  assert.equal(titleSize('Multiplying Fractions'), 'slide-display-md');
  assert.equal(titleSize('Understanding Photosynthesis Pathways Fully'), 'slide-display-sm');
});

const run = (actions: DeckAction[], start: DeckState = initialDeckState(lesson)) => {
  const reduce = makeDeckReducer(lesson);
  return actions.reduce(reduce, start);
};

test('big idea can be joined and replayed', () => {
  assert.equal(run([{ type: 'join' }]).joined, true);
  assert.equal(run([{ type: 'join' }, { type: 'unjoin' }]).joined, false);
});

test('teach tracks which cases were opened and ignores out-of-range taps', () => {
  const s = run([{ type: 'case', index: 1 }, { type: 'case', index: 0 }, { type: 'case', index: 9 }]);
  assert.equal(s.caseIndex, 0);
  assert.deepEqual([...s.seenCases].sort(), [0, 1]);
});

test('the rule unlocks only after both cards are fully tested', () => {
  const half = run([
    { type: 'test', card: 'example', part: 0 },
    { type: 'test', card: 'example', part: 1 },
  ]);
  assert.equal(cardComplete(half.tested.example), true);
  assert.equal(strategyUnlocked(half), false);
  const all = run([
    { type: 'test', card: 'example', part: 0 },
    { type: 'test', card: 'example', part: 1 },
    { type: 'test', card: 'nonExample', part: 0 },
    { type: 'test', card: 'nonExample', part: 1 },
  ]);
  assert.equal(strategyUnlocked(all), true);
  // a second tap un-tests the part
  assert.equal(run([{ type: 'test', card: 'example', part: 0 }, { type: 'test', card: 'example', part: 0 }]).tested.example[0], false);
  assert.equal(partState(false, true), 'untested');
  assert.equal(partState(true, true), 'holds');
  assert.equal(partState(true, false), 'fails');
});

test('guided practice allows retries then reveals the answer', () => {
  const correct = lesson.guidedPractice.options.findIndex((o) => o.correct);
  const wrong = lesson.guidedPractice.options.map((_, i) => i).filter((i) => i !== correct);
  assert.equal(MAX_WRONG_PICKS, 2);

  const one = run([{ type: 'pick', index: wrong[0]! }]);
  assert.equal(one.practice.solved, false);
  assert.equal(one.practice.lastPick, wrong[0]);

  const found = run([{ type: 'pick', index: wrong[0]! }, { type: 'pick', index: correct }]);
  assert.equal(found.practice.solved, true);
  assert.equal(found.practice.revealed, false);

  const gaveUp = run([{ type: 'pick', index: wrong[0]! }, { type: 'pick', index: wrong[1]! }]);
  assert.equal(gaveUp.practice.solved, true);
  assert.equal(gaveUp.practice.revealed, true);
  assert.equal(gaveUp.practice.lastPick, correct);

  // once solved, nothing changes
  assert.deepEqual(run([{ type: 'pick', index: wrong[1]! }], found).practice, found.practice);
  // same wrong option twice is one miss, not two
  assert.equal(run([{ type: 'pick', index: wrong[0]! }, { type: 'pick', index: wrong[0]! }]).practice.solved, false);
});

test('quiz needs every answer before submitting, locks after, and resets on retry', () => {
  const n = lesson.quiz.items.length;
  assert.equal(run([{ type: 'submit' }]).quiz.submitted, false, 'nothing answered');

  const answers: DeckAction[] = lesson.quiz.items.map((item, i) => ({ type: 'answer', item: i, choice: item.answerIndex }));
  const partial = run(answers.slice(0, n - 1));
  assert.equal(run([{ type: 'submit' }], partial).quiz.submitted, false, 'one missing');

  const done = run([...answers, { type: 'submit' }]);
  assert.equal(done.quiz.submitted, true);
  assert.equal(scoreQuiz(done.quiz.answers, lesson.quiz.items).passed, true);

  const locked = run([{ type: 'answer', item: 0, choice: 1 - lesson.quiz.items[0]!.answerIndex }], done);
  assert.deepEqual(locked.quiz.answers, done.quiz.answers, 'answers are frozen after submit');

  const retry = run([{ type: 'retry' }], done);
  assert.equal(retry.quiz.submitted, false);
  assert.equal(retry.quiz.attempts, 1);
  assert(retry.quiz.answers.every((a) => a === null));
  assert.equal(run([{ type: 'retry' }]).quiz.attempts, 0, 'retry does nothing before submit');
});

/* -------------------------- generator behaviour ------------------------- */

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};
const reply = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  finishReason: { unified: 'stop' as const, raw: 'stop' },
  usage,
  warnings: [],
});
const mock = (...replies: unknown[]) =>
  new MockLanguageModelV4({ doGenerate: replies.map(reply) as never });
const input = {
  question: { kind: 'text' as const, text: 'Jamal has 34 stickers and gets 25 more. How many now?' },
  classification,
};

test('generator returns a clean first draft untouched apart from option order', async () => {
  const model = mock(lesson);
  const result = await generateLesson(input, 'mock', model);
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(LessonSchema.safeParse(result.lesson).success, true);
  assert.equal(result.lesson.title, lesson.title);
  const raw = result.rawResponse as { attempts: number; quality: unknown[]; lessonVersion: number };
  assert.equal(raw.attempts, 1);
  assert.deepEqual(raw.quality, []);
  assert.equal(raw.lessonVersion, 2);
});

test('generator regenerates once when a draft fails a pedagogy check, and keeps the better one', async () => {
  const flawed = clone(lesson);
  flawed.quiz.items.forEach((i) => (i.answerIndex = 0));
  const model = mock(flawed, lesson);
  const result = await generateLesson(input, 'mock', model);
  assert.equal(model.doGenerateCalls.length, 2);
  assert.equal(needsRepair(lessonQualityIssues(result.lesson, ctx)), false);
  assert.equal((result.rawResponse as { attempts: number }).attempts, 2);
  // the corrective turn names the problem so the model can act on it
  const retryPrompt = JSON.stringify(model.doGenerateCalls[1]!.prompt);
  assert.match(retryPrompt, /quiz\.items/);
});

test('generator keeps the first draft when the repair is no better', async () => {
  const flawed = clone(lesson);
  flawed.quiz.items.forEach((i) => (i.answerIndex = 0));
  const worse = clone(flawed);
  worse.guidedPractice.options[0]!.feedback = 'No.';
  const model = mock(flawed, worse);
  const result = await generateLesson(input, 'mock', model);
  const raw = result.rawResponse as { quality: Array<{ code: string }> };
  assert(raw.quality.some((i) => i.code === 'quiz-same-answer'));
  assert(!raw.quality.some((i) => i.code === 'feedback-thin'), 'the worse draft was not kept');
});

test('generator retries when the model breaks a cross-field schema rule', async () => {
  const invalid = clone(lesson);
  invalid.guidedPractice.options.forEach((o) => (o.correct = false));
  const model = mock(invalid, lesson);
  const result = await generateLesson(input, 'mock', model);
  assert.equal(model.doGenerateCalls.length, 2);
  assert.equal(result.lesson.guidedPractice.options.filter((o) => o.correct).length, 1);
});

test('schema issues are read from nested causes and absent when unrelated', () => {
  const nested = { cause: { cause: { issues: [{ path: ['guidedPractice', 'options'], message: 'exactly one option must be correct' }] } } };
  assert.match(describeSchemaIssues(nested) ?? '', /guidedPractice\.options: exactly one option/);
  assert.equal(describeSchemaIssues(new Error('network down')), null);
  assert.equal(describeSchemaIssues(undefined), null);
});
