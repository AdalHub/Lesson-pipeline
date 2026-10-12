import { generateObject, type UserContent } from 'ai';
import { z } from 'zod';
import { CLASSIFY_MODEL_ID, getModel } from './model';
import { imageFilePart } from './parts';
import {
  ClassificationSchema,
  QUESTION_TYPES,
  type Classification,
} from './schemas';
import {
  planTeksRetrieval,
  researchOfficialTeks,
  retrieveTeksCandidates,
  type RetrievalPlan,
  type RetrievedTeks,
  type WebResearch,
} from './teks-retrieval';

export type ClassifyInput =
  | { kind: 'text'; text: string }
  | { kind: 'image'; imageDataUrl: string };

export type ClassifyResult = {
  classification: Classification;
  model: string;
  latencyMs: number;
  rawResponse: unknown;
};

/** Number of parallel constrained selections to vote over. 1 disables voting. */
const SAMPLE_COUNT = Math.max(1, Number(process.env.AI_CLASSIFY_SAMPLES ?? 3) || 3);

const CandidateSelectionSchema = z.object({
  reasoning: z
    .string()
    .describe('Explain the skill match and candidate comparison FIRST.'),
  selectedCandidateKey: z
    .string()
    .describe('Copy one candidate key exactly, or use "unknown".'),
  gradeLevelConfidence: z.enum(['high', 'medium', 'low']),
  questionType: z.enum(QUESTION_TYPES),
  difficulty: z.enum(['below_grade', 'on_grade', 'above_grade']),
  keyConcepts: z.array(z.string()).min(1).max(5),
});

type CandidateSelection = z.infer<typeof CandidateSelectionSchema>;

function candidateKey(candidate: RetrievedTeks) {
  return `${candidate.subject}:${candidate.code}`;
}

function buildUserContent(input: ClassifyInput): UserContent {
  if (input.kind === 'text') {
    return [
      {
        type: 'text',
        text: `Select the TEKS standard for this test question.\n\nQuestion:\n${input.text}`,
      },
    ];
  }
  return [
    {
      type: 'text',
      text: 'Select the TEKS standard for the test question in this screenshot. Read it carefully first.',
    },
    imageFilePart(input.imageDataUrl),
  ];
}

function candidateReference(candidates: RetrievedTeks[]) {
  return candidates
    .map(
      (candidate) =>
        `- key=${candidateKey(candidate)} | grade=${candidate.gradeLevel} | ` +
        `course=${candidate.course ?? 'none'} | ${candidate.description} | ` +
        `official expectation=${candidate.studentExpectation}`,
    )
    .join('\n');
}

function hydrateClassification(
  selection: CandidateSelection,
  candidates: RetrievedTeks[],
  plan: RetrievalPlan,
): Classification {
  const selected = candidates.find(
    (candidate) => candidateKey(candidate) === selection.selectedCandidateKey,
  );

  const proposed: Classification = selected
    ? {
        reasoning: selection.reasoning,
        gradeLevel: selected.gradeLevel,
        gradeLevelConfidence: selection.gradeLevelConfidence,
        subject: ClassificationSchema.shape.subject.parse(selected.subject),
        teksStandard: selected.code,
        teksDescription: selected.description,
        questionType: selection.questionType,
        difficulty: selection.difficulty,
        keyConcepts: selection.keyConcepts,
      }
    : {
        reasoning: `${selection.reasoning} No retrieved candidate was a defensible match.`,
        gradeLevel: plan.estimatedGrade,
        gradeLevelConfidence: 'low',
        subject: plan.subject,
        teksStandard: 'unknown',
        teksDescription: 'No verified TEKS standard was selected from the retrieved corpus.',
        questionType: selection.questionType,
        difficulty: selection.difficulty,
        keyConcepts: selection.keyConcepts,
      };

  return ClassificationSchema.parse(proposed);
}

type Sample = {
  classification: Classification;
  selectedCandidateKey: string;
  modelId: string;
  responseId: string;
  latencyMs: number;
  finishReason: string;
  usage: unknown;
  body: unknown;
};

async function classifyOnce(
  content: UserContent,
  candidates: RetrievedTeks[],
  plan: RetrievalPlan,
  research: WebResearch,
  modelId: string,
): Promise<Sample> {
  const started = performance.now();
  const result = await generateObject({
    model: getModel(modelId),
    schema: CandidateSelectionSchema,
    schemaName: 'TeksCandidateSelection',
    schemaDescription: 'Selection from retrieved and validated TEKS candidates.',
    instructions: `You classify K-12 questions against TEKS, but you may only
select from the retrieved database records below. Compare the tested skill to
the official student expectation, then copy the best candidate key exactly.
Use "unknown" if no candidate directly assesses the skill. Never invent or
alter a code. Difficulty is relative to the selected standard's grade.

Retrieval analysis:
${plan.reasoning}

Official-source web evidence (supporting evidence; the database is authoritative):
${research.text || 'No web evidence was available.'}

Retrieved TEKS candidates:
${candidateReference(candidates)}`,
    messages: [{ role: 'user', content }],
    temperature: 0,
  });

  return {
    classification: hydrateClassification(result.object, candidates, plan),
    selectedCandidateKey: result.object.selectedCandidateKey,
    modelId: result.response.modelId || modelId,
    responseId: result.response.id,
    latencyMs: Math.round(performance.now() - started),
    finishReason: result.finishReason,
    usage: result.usage,
    body: result.response.body ?? null,
  };
}

/** Pick the most common validated subject/code pair, then the earliest sample. */
export function pickByVote(samples: Sample[]): Sample {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    const key = `${sample.classification.subject}:${sample.classification.teksStandard}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const winningKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  return samples.find(
    (sample) =>
      `${sample.classification.subject}:${sample.classification.teksStandard}` === winningKey,
  )!;
}

/**
 * CALL 1 — plan retrieval, consult official web sources, retrieve database
 * candidates, and make a constrained selection. Lesson generation remains a
 * separate call and receives only this validated classification.
 */
export async function classify(
  input: ClassifyInput,
  modelId: string = CLASSIFY_MODEL_ID,
  sampleCount: number = SAMPLE_COUNT,
): Promise<ClassifyResult> {
  const started = performance.now();
  const planned = await planTeksRetrieval(input, modelId);
  const research = await researchOfficialTeks(planned.plan, modelId);
  const candidates = await retrieveTeksCandidates(planned.plan, research);
  const content = buildUserContent(input);

  const settled = await Promise.allSettled(
    Array.from({ length: sampleCount }, () =>
      classifyOnce(content, candidates, planned.plan, research, modelId),
    ),
  );
  const samples = settled
    .filter((sample): sample is PromiseFulfilledResult<Sample> => sample.status === 'fulfilled')
    .map((sample) => sample.value);

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
      groundingVersion: 1,
      selectedResponseId: winner.responseId,
      selectedCandidateKey: winner.selectedCandidateKey,
      retrievalPlan: {
        ...planned.plan,
        responseId: planned.responseId,
        model: planned.model,
        latencyMs: planned.latencyMs,
        usage: planned.usage,
      },
      webResearch: research,
      retrievedCandidates: candidates.map((candidate) => ({
        key: candidateKey(candidate),
        code: candidate.code,
        subject: candidate.subject,
        gradeLevel: candidate.gradeLevel,
        description: candidate.description,
        studentExpectation: candidate.studentExpectation,
        sourceUrl: candidate.sourceUrl,
        effectiveVersion: candidate.effectiveVersion,
        retrievalScore: candidate.retrievalScore,
      })),
      sampleCount,
      succeeded: samples.length,
      samples: samples.map((sample) => ({
        responseId: sample.responseId,
        modelId: sample.modelId,
        latencyMs: sample.latencyMs,
        finishReason: sample.finishReason,
        usage: sample.usage,
        selectedCandidateKey: sample.selectedCandidateKey,
        object: sample.classification,
        body: sample.body,
      })),
    },
  };
}
