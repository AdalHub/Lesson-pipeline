import { generateObject, type UserContent } from 'ai';
import { CLASSIFY_MODEL_ID, getModel } from './model';
import { ClassificationSchema, type Classification } from './schemas';
import { TEKS_ANCHORS, gradeFromTeksCode } from './teks';

export const CLASSIFY_SYSTEM = `
You classify K-12 test questions against the Texas Essential Knowledge
and Skills (TEKS) standards.

Given a question, identify the grade level, subject, and the specific TEKS
standard it assesses. Anchor every judgment to TEKS — do not guess a grade
level from general impression. Ask yourself which TEKS standard this
question is testing, then report the grade that standard belongs to.

If you cannot confidently map it to a TEKS standard, set teksStandard to
"unknown", give your best grade estimate, and set gradeLevelConfidence to "low".
Never invent a TEKS code.

Procedure:
1. In "reasoning", first name the exact skill the question requires (e.g. "equal-groups multiplication", "slope from two points", "identify a physical change").
2. Name the single TEKS student expectation that most directly assesses that skill, using the landmarks and boundary rules below when they apply.
3. gradeLevel MUST be the grade of that standard (for high-school course codes, the typical grade for that course). Do not report a different grade from the code.
4. difficulty is relative to the typical rigor of that standard at that grade.
5. keyConcepts are 1-5 short noun phrases a teacher would use.
6. If the question is a screenshot, read the question from the image first, then classify it.

${TEKS_ANCHORS}
`.trim();

export type ClassifyInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; imageDataUrl: string };

export type ClassifyResult = {
  classification: Classification;
  model: string;
  latencyMs: number;
  rawResponse: unknown;
};

/** Number of parallel samples to vote over. 1 disables voting. */
const SAMPLE_COUNT = Math.max(1, Number(process.env.AI_CLASSIFY_SAMPLES ?? 3) || 3);

function buildUserContent(input: ClassifyInput): UserContent {
  if (input.kind === 'text') {
    return [
      {
        type: 'text',
        text: `Classify this test question.\n\nQuestion:\n${input.text}`,
      },
    ];
  }
  return [
    {
      type: 'text',
      text: 'Classify the test question shown in this screenshot. Read it carefully first.',
    },
    { type: 'image', image: input.imageDataUrl },
  ];
}

type Sample = {
  classification: Classification;
  modelId: string;
  responseId: string;
  latencyMs: number;
  finishReason: string;
  usage: unknown;
  body: unknown;
};

async function classifyOnce(
  content: UserContent,
  modelId: string,
): Promise<Sample> {
  const started = performance.now();
  const result = await generateObject({
    model: getModel(modelId),
    schema: ClassificationSchema,
    schemaName: 'Classification',
    schemaDescription: 'TEKS-anchored classification of a K-12 test question.',
    instructions: CLASSIFY_SYSTEM,
    messages: [{ role: 'user', content }],
    temperature: 0,
  });
  return {
    classification: reconcileGrade(result.object),
    modelId: result.response.modelId || modelId,
    responseId: result.response.id,
    latencyMs: Math.round(performance.now() - started),
    finishReason: result.finishReason,
    usage: result.usage,
    body: result.response.body ?? null,
  };
}

/**
 * The spec's rule is "report the grade that standard belongs to". If the
 * model's gradeLevel disagrees with the grade implied by its own TEKS code,
 * the code wins and confidence is lowered one notch.
 */
export function reconcileGrade(c: Classification): Classification {
  const codeGrade = gradeFromTeksCode(c.teksStandard);
  if (codeGrade === null || codeGrade === c.gradeLevel) return c;
  return {
    ...c,
    gradeLevel: codeGrade,
    gradeLevelConfidence:
      c.gradeLevelConfidence === 'high' ? 'medium' : 'low',
  };
}

/**
 * Pick the sample to return: majority grade, then the most common TEKS code
 * within that grade, then the earliest sample.
 */
export function pickByVote(samples: Sample[]): Sample {
  const gradeCounts = new Map<number, number>();
  for (const s of samples) {
    const g = s.classification.gradeLevel;
    gradeCounts.set(g, (gradeCounts.get(g) ?? 0) + 1);
  }
  const winningGrade = [...gradeCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0] - b[0],
  )[0]![0];

  const inGrade = samples.filter(
    (s) => s.classification.gradeLevel === winningGrade,
  );
  const codeCounts = new Map<string, number>();
  for (const s of inGrade) {
    const code = s.classification.teksStandard;
    codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
  }
  const winningCode = [...codeCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];

  return inGrade.find((s) => s.classification.teksStandard === winningCode)!;
}

/** CALL 1 — classify a question against TEKS. */
export async function classify(
  input: ClassifyInput,
  modelId: string = CLASSIFY_MODEL_ID,
  sampleCount: number = SAMPLE_COUNT,
): Promise<ClassifyResult> {
  const started = performance.now();
  const content = buildUserContent(input);

  const settled = await Promise.allSettled(
    Array.from({ length: sampleCount }, () => classifyOnce(content, modelId)),
  );
  const samples = settled
    .filter((s): s is PromiseFulfilledResult<Sample> => s.status === 'fulfilled')
    .map((s) => s.value);

  if (samples.length === 0) {
    const first = settled[0] as PromiseRejectedResult;
    throw first.reason;
  }

  const winner = pickByVote(samples);
  const latencyMs = Math.round(performance.now() - started);

  return {
    classification: winner.classification,
    model: winner.modelId,
    latencyMs,
    rawResponse: {
      selectedResponseId: winner.responseId,
      sampleCount,
      succeeded: samples.length,
      samples: samples.map((s) => ({
        responseId: s.responseId,
        modelId: s.modelId,
        latencyMs: s.latencyMs,
        finishReason: s.finishReason,
        usage: s.usage,
        object: s.classification,
        body: s.body,
      })),
    },
  };
}
