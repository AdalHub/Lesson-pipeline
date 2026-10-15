import { generateObject, type LanguageModel, type UserContent } from 'ai';
import {
  lessonQualityIssues,
  needsRepair,
  normalizeLesson,
  repairNote,
  type QualityIssue,
} from './lesson-quality';
import { GENERATE_MODEL_ID, getModel } from './model';
import { imageFilePart } from './parts';
import { LessonSchema, type Classification, type Lesson } from './schemas';

/**
 * CALL 2 — the lesson writer.
 *
 * The schema fixes the deck: seven screens built from the reference deck's
 * eight steps, in an order a student should meet them. This prompt fixes the
 * learning science that fills them. The model is not asked what a lesson
 * should contain, only to write a good one in this shape.
 * LESSON_DESIGN.md explains each principle named below.
 */
export const GENERATE_SYSTEM = `
You design short, interactive lessons that teach ONE skill to a student who just
met a test question on it. The lesson is a deck of slides the student taps
through. You will be given the question and its classification (grade level,
subject, TEKS standard, key concepts).

WRITE THE PLAN FIRST. Decide the learning goal, the prior knowledge it builds
on, the single core misconception for this skill, and the success criteria.
Everything after the plan must serve it: the non-example, every wrong option,
at least one quiz item and the recap warning all target that same misconception.
The misconception should be the mistake students make because a surface cue
misleads them (for example "any sentence with and is compound"), not carelessness.

THE SLIDES, AND THE PRINCIPLE EACH ONE SERVES
1. Title: hook and goal. "objective" is one sentence in student language
   starting with "Learn to". "keyTerms" are the few words or symbols at the
   heart of the skill, one word or symbol each (like "and", "but", "or", "so"
   or "+", "-", "x"). They appear in a small speech bubble. Never phrases.
2. Big idea: CONCRETE BEFORE ABSTRACT. Show a concrete example being
   transformed ("before" parts -> "after" result) and only then state the rule
   in one sentence. The "before" parts are the pieces on their own, so they
   must NOT contain what the tap reveals: no joining word, operator or
   punctuation that the lesson teaches. The action can be join, solve, sort, compare, infer or apply;
   choose the verb that is the skill. Signal parts with segment roles: "key"
   for the element the student must notice, "mark" for a symbol or punctuation
   that matters, "focus" for the answer or result, "plain" for the rest. Use at
   most two signalled elements. Each annotation explains one of those roles, and
   a role may be annotated only if "after" contains a segment with that role.
3. Teach: VARIED EXAMPLES. Two to four cases of the same idea (the joining
   words; the operations; the kinds of evidence). Surface features change from
   case to case. Each case shows what the SAME self-check finds, worded the
   same way every time, so the student sees one rule across all cases. When the
   skill is a classification (physical or chemical, fact or opinion), include
   one contrasting case with "holds" set to false.
4. Strategy: A TRANSFERABLE SELF-CHECK. Name a short procedure the student can
   run on any item (like "The Cover Test": cover one half, then the other).
   Give an example in which every part passes and a non-example that looks
   right but fails at least one part. The non-example is a minimal pair with
   the example and embodies the core misconception. "rule" is one decision line
   with an arrow written as ->.
5. Guided practice: RETRIEVAL WITH ELABORATED FEEDBACK. One question and three
   options, exactly one correct. All three options share the same surface cue
   (the same joining word, the same operation, the same key word) so the student
   cannot answer by spotting it. Each wrong option is one specific error a real
   student makes. Every option's feedback says WHY by naming the parts, never
   just "incorrect". The hint points at the strategy without giving the answer.
6. Quiz: INDEPENDENT RETRIEVAL. Three to five short items, each with two to
   four choices of one to three words (for example "Compound" / "Not", or
   "Physical" / "Chemical"). Vary which choice is correct. Results appear only
   after the last answer, so every explanation must stand on its own. Mark the
   items built to catch the misconception.
7. Recap: CONSOLIDATION. Exactly two takeaways, each a sentence a student could
   repeat tomorrow (what to do), then "watchOut": the core misconception as a
   memorable warning. The three are shown together as three rows.

RULES
- One skill per lesson. One idea per slide. Headings up to eight words; any
  other sentence up to about twenty words. Shorter is better.
- All examples, practice options and quiz items are NEW items of the same type
  as the question. Never reuse, paraphrase or solve the original question, and
  never copy a sentence, option or number set from it: invent a different
  context with different names, objects and numbers for every example.
- Items on the same slide should differ in surface features (names, objects,
  numbers) but not in the skill.
- Grade tone. Grades 1-3: very short sentences, concrete objects, playful,
  friendly names. Grades 4-5: short sentences, concrete examples, light humour.
  Grades 6-8: clear and direct, precise terms introduced with a plain gloss.
  Grades 9-12: precise vocabulary, formal reasoning and the notation of the
  course; the title can still be punchy, the tone is never childish.
- Plain text only: no Markdown, no LaTeX, no emoji. Write math as 3 x 4 = 12,
  x^2, 3/4. Quotation marks and apostrophes are fine.
`.trim();

export type GenerateInput = {
  /** The original question, or the screenshot it appears in. */
  question:
    | { kind: 'text'; text: string }
    | { kind: 'image'; imageDataUrl: string };
  classification: Classification;
};

export type GenerateResult = {
  lesson: Lesson;
  model: string;
  latencyMs: number;
  rawResponse: unknown;
};

export const SUBJECT_LABELS: Record<Classification['subject'], string> = {
  math: 'Math',
  reading_language_arts: 'Reading / Language Arts',
  science: 'Science',
  social_studies: 'Social Studies',
  other: 'Other',
};

function describeClassification(c: Classification) {
  return [
    `Grade level: ${c.gradeLevel}`,
    `Subject: ${SUBJECT_LABELS[c.subject]}`,
    `TEKS: ${c.teksStandard} — ${c.teksDescription}`,
    `Question type: ${c.questionType.replace(/_/g, ' ')}`,
    `Difficulty: ${c.difficulty.replace(/_/g, ' ')}`,
    `Key concepts: ${c.keyConcepts.join(', ')}`,
  ].join('\n');
}

function buildUserContent(input: GenerateInput): UserContent {
  const meta = describeClassification(input.classification);
  const ask = 'Write the lesson deck. Start with the plan.';

  if (input.question.kind === 'text') {
    return [
      {
        type: 'text',
        text: `Question:\n${input.question.text}\n\n${meta}\n\n${ask}`,
      },
    ];
  }

  return [
    {
      type: 'text',
      text: `Question: (shown in the attached screenshot)\n\n${meta}\n\n${ask}`,
    },
    imageFilePart(input.question.imageDataUrl),
  ];
}

/**
 * Zod issues from the schema's cross-field checks, as a note for a retry.
 * The AI SDK wraps the validation error, so walk the cause chain.
 */
export function describeSchemaIssues(err: unknown): string | null {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth++) {
    const issues = (current as { issues?: unknown }).issues;
    if (Array.isArray(issues) && issues.length > 0) {
      return issues
        .slice(0, 6)
        .map((i) => {
          const issue = i as { path?: unknown[]; message?: string };
          return `- ${(issue.path ?? []).join('.') || 'lesson'}: ${issue.message ?? 'invalid'}`;
        })
        .join('\n');
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** Wall-clock budget for everything this call may spend, retry included. */
const BUDGET_MS = 85_000;
const ATTEMPT_MS = 55_000;
/** A retry needs enough time left to finish a whole lesson. */
const MIN_RETRY_MS = 25_000;

/** CALL 2 — generate a lesson, given the question and call 1's classification. */
export async function generateLesson(
  input: GenerateInput,
  modelId: string = GENERATE_MODEL_ID,
  /** Test seam: supply a model instead of calling the provider. */
  model: LanguageModel = getModel(modelId),
): Promise<GenerateResult> {
  const started = performance.now();
  const content = buildUserContent(input);
  const remaining = () => BUDGET_MS - (performance.now() - started);
  const quality = {
    gradeLevel: input.classification.gradeLevel,
    question: input.question.kind === 'text' ? input.question.text : undefined,
  };

  const attempt = (note: string | null) =>
    generateObject({
      abortSignal: AbortSignal.timeout(Math.min(ATTEMPT_MS, Math.max(5_000, remaining()))),
      maxRetries: 1,
      model,
      schema: LessonSchema,
      schemaName: 'Lesson',
      schemaDescription:
        'An interactive lesson deck that teaches the skill behind this question.',
      instructions: GENERATE_SYSTEM,
      messages: [
        { role: 'user', content },
        ...(note
          ? [
              {
                role: 'user' as const,
                content: `Your previous draft broke these rules. Write the whole lesson again and fix them:\n${note}`,
              },
            ]
          : []),
      ],
      // A corrective pass should follow the rules, not explore.
      temperature: note ? 0.4 : 0.7,
    });

  let result: Awaited<ReturnType<typeof attempt>>;
  let attempts = 1;
  /** Why a second draft was requested, kept with the lesson for tuning. */
  let repair: { reason: 'schema' | 'quality'; notes: string } | null = null;
  let repairFailure: string | null = null;
  try {
    result = await attempt(null);
  } catch (err) {
    // The schema's cross-field checks (one correct option, a failing part in
    // the non-example, ...) cannot be expressed in JSON Schema, so the model
    // can miss them. One corrective pass with the exact issues fixes most.
    const note = describeSchemaIssues(err);
    if (!note || remaining() < MIN_RETRY_MS) throw err;
    attempts = 2;
    repair = { reason: 'schema', notes: note };
    result = await attempt(note);
  }

  // Deterministic fixes (answer positions) come first, so the quality checks
  // judge the lesson the student will actually see.
  let lesson = normalizeLesson(result.object);
  let issues: QualityIssue[] = lessonQualityIssues(lesson, quality);

  if (needsRepair(issues) && attempts < 2 && remaining() >= MIN_RETRY_MS) {
    try {
      const note = repairNote(issues);
      const retried = await attempt(note);
      attempts = 2;
      repair = { reason: 'quality', notes: note };
      const retriedLesson = normalizeLesson(retried.object);
      const retriedIssues = lessonQualityIssues(retriedLesson, quality);
      const before = issues.filter((i) => i.level === 'fix').length;
      const after = retriedIssues.filter((i) => i.level === 'fix').length;
      // Keep the better of the two drafts; never trade a usable lesson for a worse one.
      if (after <= before) {
        result = retried;
        lesson = retriedLesson;
        issues = retriedIssues;
      }
    } catch (err) {
      // The first draft is valid and usable; the repair pass is best effort.
      // Keep the reason so a failing repair path is visible in the stored row.
      repairFailure = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    }
  }

  const latencyMs = Math.round(performance.now() - started);

  return {
    lesson,
    model: result.response.modelId || modelId,
    latencyMs,
    rawResponse: {
      finishReason: result.finishReason,
      usage: result.usage,
      responseId: result.response.id,
      modelId: result.response.modelId,
      lessonVersion: 2,
      attempts,
      repair,
      repairFailure,
      quality: issues,
    },
  };
}
