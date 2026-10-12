/** Real HTTP/tRPC + provider smoke check. Costs API usage and saves demo lessons. */
import assert from 'node:assert/strict';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../src/server/api/root';
import { ClassificationSchema, LessonSchema } from '../src/server/ai/schemas';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const api = createTRPCProxyClient<AppRouter>({ links: [httpLink({ url: `${baseUrl}/api/trpc`, transformer: superjson })] });
const questions = [
  { subject: 'science', grades: [7], code: '7.6C', text: 'Which change is physical rather than chemical? A) An iron fence rusts. B) A glass bottle is crushed into small pieces. C) A log burns to ash. D) Vinegar reacts with baking soda to release gas.' },
  { subject: 'reading_language_arts', grades: [2, 3, 4, 5], code: null, text: 'Read the passage: Maya looked at the dark clouds. She took her umbrella from the hook before leaving for school. What can you infer about why Maya took her umbrella? Use evidence from the passage to explain your answer.' },
  { subject: 'social_studies', grades: [5], code: '5.14B', text: 'The Preamble to the U.S. Constitution says "establish Justice" and "provide for the common defence." Explain what these two purposes mean and give an example of how the national government fulfills each purpose.' },
];

async function main() {
  const results = [];
  for (const fixture of questions) {
    const start = Date.now();
    const result = await api.lesson.generate.mutate({ inputType: 'text', text: fixture.text });
    const c = ClassificationSchema.parse(result.classification);
    LessonSchema.parse(result.lesson.content);
    const saved = await api.lesson.getById.query({ id: result.submissionId });
    assert.equal(saved.lesson?.id, result.lesson.id);
    assert.equal(c.subject, fixture.subject);
    assert(fixture.grades.includes(c.gradeLevel), `Unexpected grade ${c.gradeLevel} for ${fixture.subject}`);
    if (fixture.code) assert.equal(c.teksStandard, fixture.code);
    assert.notEqual(c.teksStandard, 'unknown');
    if (fixture.subject === 'reading_language_arts') {
      assert.equal(c.gradeLevelConfidence, 'low', 'Recurring inference standard must disclose grade ambiguity');
      assert.equal(c.teksStandard, `${c.gradeLevel}.6F`);
    }
    const raw = result.classification.rawResponse as { groundingVersion: number; selectedCandidateKey: string; retrievedCandidates: Array<{ key: string; code: string; gradeLevel: number }>; webResearch: { sources: unknown[]; error?: string } };
    assert.equal(raw.groundingVersion, 1);
    const selected = raw.retrievedCandidates.find(row => row.key === raw.selectedCandidateKey);
    assert(selected);
    assert.equal(selected.gradeLevel, c.gradeLevel);
    assert.equal(selected.code, c.teksStandard);
    const summary = { url: `${baseUrl}/lessons/${result.submissionId}`, subject: c.subject, grade: c.gradeLevel, code: c.teksStandard, sources: raw.webResearch.sources.length, webError: raw.webResearch.error ?? null, wallMs: Date.now() - start };
    results.push(summary);
    console.log(JSON.stringify(summary));
  }
  assert(results.some(result => result.sources > 0), 'Web lookup returned no citations in any live case');
  console.log('PASS: 3 live provider/HTTP/persistence cases. Reading grade is intentionally a range: inference recurs across grades.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
