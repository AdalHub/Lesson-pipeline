import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GenerateInputSchema } from '../src/server/api/routers/lesson';
import { ClassificationSchema, LessonSchema } from '../src/server/ai/schemas';
import { boundedSampleCount, hydrateClassification, pickByVote } from '../src/server/ai/classify';
import { rankTeksCandidates, type RetrievalPlan, type WebResearch } from '../src/server/ai/teks-retrieval';
import type { TeksStandardRow } from '../src/server/db/schema';
import { imageFilePart } from '../src/server/ai/parts';
import snapshot from '../data/teks-expanded.json';
import { classification, lesson } from './fixtures';

const plan: RetrievalPlan = { reasoning: 'addition', normalizedQuestion: 'Join 12 and 24', subject: 'math', estimatedGrade: 2, skill: 'addition', searchTerms: ['addition', 'joining', 'word problems'] };
const research: WebResearch = { text: 'TEKS 2.4(C)', sources: [], model: 'test', latencyMs: 0, usage: null };
const row: TeksStandardRow = { id: 'test', code: '2.4C', subject: 'math', gradeLevel: 2, course: null, knowledgeAndSkills: 'Number operations', studentExpectation: 'Solve addition word problems', description: 'Addition', effectiveVersion: '2012', sourceUrl: 'https://tea.texas.gov', sourceKind: 'official', searchText: 'addition joining word problems', createdAt: new Date(0) };

test('input accepts trimmed text or a supported screenshot', () => {
  assert.equal(GenerateInputSchema.parse({ inputType: 'text', text: '  Question  ' }).text, 'Question');
  assert(GenerateInputSchema.safeParse({ inputType: 'image', imageDataUrl: 'data:image/png;base64,AAAA' }).success);
});
for (const input of [
  { inputType: 'text', text: ' ' }, { inputType: 'text', text: 'a'.repeat(10001) },
  { inputType: 'image', text: 'question' }, { inputType: 'text' },
  { inputType: 'text', text: 'Q', imageDataUrl: 'data:image/png;base64,AAAA' },
  { inputType: 'image', imageDataUrl: 'data:image/svg+xml;base64,AAAA' },
  { inputType: 'image', imageDataUrl: 'data:image/png;base64,' + 'A'.repeat(4_000_000) },
]) test(`input rejects invalid combination ${JSON.stringify(input).slice(0, 90)}`, () => assert(!GenerateInputSchema.safeParse(input).success));
test('schema rejects out-of-range classifications and incomplete lessons', () => {
  assert(ClassificationSchema.safeParse(classification).success);
  assert(!ClassificationSchema.safeParse({ ...classification, gradeLevel: 13 }).success);
  assert(!ClassificationSchema.safeParse({ ...classification, subject: 'invented' }).success);
  assert(LessonSchema.safeParse(lesson).success);
  assert(!LessonSchema.safeParse({ ...lesson, practiceProblems: [] }).success);
});
test('image content rejects malformed data URLs', () => {
  assert.throws(() => imageFilePart('https://example.com/image.png'));
  assert.equal(imageFilePart('data:image/png;base64,AAAA').mediaType, 'image/png');
});
test('retrieval recognizes dot/parenthesis code variants without crossing subjects', () => {
  for (const code of ['2.4C', '2.4.C', '2.4(C)']) {
    const ranked = rankTeksCandidates([row, { ...row, subject: 'science' }], plan, { ...research, text: code });
    assert.equal(ranked.length, 1);
    assert(ranked[0].retrievalScore >= 25);
  }
  assert.deepEqual(rankTeksCandidates([row], { ...plan, subject: 'other' }, research), []);
});
test('hydration derives grade/code/subject from catalog and rejects invented selection', () => {
  const selection = { reasoning: 'match', selectedCandidateKey: 'math:2.4C', gradeLevelConfidence: 'high' as const, questionType: 'word_problem' as const, difficulty: 'on_grade' as const, keyConcepts: ['addition'] };
  const candidates = [{ ...row, retrievalScore: 30 }];
  assert.equal(hydrateClassification(selection, candidates, { ...plan, estimatedGrade: 10 }).gradeLevel, 2);
  const unknown = hydrateClassification({ ...selection, selectedCandidateKey: 'math:99.1Z' }, candidates, plan);
  assert.equal(unknown.teksStandard, 'unknown');
  assert.equal(unknown.gradeLevelConfidence, 'low');
});
test('voting ties lower confidence; sample count is bounded', () => {
  const sample = { classification, selectedCandidateKey: 'math:2.4C', modelId: 'test', responseId: 'test', latencyMs: 1, finishReason: 'stop', usage: null, body: null };
  assert.equal(pickByVote([sample, { ...sample, classification: { ...classification, teksStandard: 'unknown' } }]).classification.gradeLevelConfidence, 'low');
  assert.throws(() => pickByVote([]));
  assert.deepEqual([0, 2.8, 100, Infinity, NaN].map(boundedSampleCount), [1, 2, 5, 3, 3]);
});
test('an expectation repeated across grades cannot claim high grade confidence', () => {
  const selection = { reasoning: 'match', selectedCandidateKey: 'math:2.4C', gradeLevelConfidence: 'high' as const, questionType: 'word_problem' as const, difficulty: 'on_grade' as const, keyConcepts: ['addition'] };
  const result = hydrateClassification(selection, [
    { ...row, retrievalScore: 30 },
    { ...row, code: '3.4C', gradeLevel: 3, retrievalScore: 28 },
  ], plan);
  assert.equal(result.gradeLevelConfidence, 'low');
  assert.match(result.reasoning, /recurs across multiple grades/);
});
test('expanded catalog preserves known official codes, subject isolation, provenance and coverage', () => {
  const rows = snapshot.standards;
  assert.equal(new Set(rows.map(r => `${r.subject}:${r.code}`)).size, rows.length);
  for (const subject of ['reading_language_arts', 'social_studies']) for (let grade = 1; grade <= 5; grade++) {
    assert(rows.filter(r => r.subject === subject && r.gradeLevel === grade).length > 20);
  }
  assert.match(rows.find(r => r.subject === 'reading_language_arts' && r.code === '3.6F')!.studentExpectation, /make inferences/);
  assert.match(rows.find(r => r.subject === 'social_studies' && r.code === '5.14A')!.studentExpectation, /Declaration of Independence/);
  for (const r of rows) {
    assert.match(r.sourceUrl, /^https:\/\/tea\.texas\.gov\//);
    assert(!/Source:|Update Page|§113\.|§110\./.test(r.studentExpectation));
  }
});
