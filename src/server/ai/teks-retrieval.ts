import { generateObject, generateText, type UserContent } from 'ai';
import { z } from 'zod';
import { db } from '@/server/db';
import { teksStandards, type TeksStandardRow } from '@/server/db/schema';
import { CLASSIFY_MODEL_ID, getModel, getResponsesModel, openai } from './model';
import { imageFilePart } from './parts';
import { SUBJECTS } from './schemas';
import type { ClassifyInput } from './classify';

const RetrievalPlanSchema = z.object({
  reasoning: z
    .string()
    .describe('Identify the exact skill needed before estimating subject or grade.'),
  normalizedQuestion: z
    .string()
    .describe('A faithful text transcription/normalization of the question.'),
  subject: z.enum(SUBJECTS),
  estimatedGrade: z.number().int().min(1).max(12),
  skill: z.string().describe('A concise curriculum skill, not an answer.'),
  searchTerms: z
    .array(z.string())
    .min(3)
    .max(10)
    .describe('Short standards-language phrases useful for TEKS retrieval.'),
});

export type RetrievalPlan = z.infer<typeof RetrievalPlanSchema>;

export type WebSource = {
  url: string;
  title: string | null;
};

export type WebResearch = {
  text: string;
  sources: WebSource[];
  model: string;
  latencyMs: number;
  usage: unknown;
  error?: string;
};

export type RetrievedTeks = TeksStandardRow & { retrievalScore: number };

function plannerContent(input: ClassifyInput): UserContent {
  if (input.kind === 'text') {
    return [{ type: 'text', text: `Analyze this test question for standards retrieval:\n\n${input.text}` }];
  }
  return [
    {
      type: 'text',
      text: 'Read the test question in this screenshot, then prepare a standards-retrieval plan.',
    },
    imageFilePart(input.imageDataUrl),
  ];
}

/** Read/OCR the question and translate it into curriculum search language. */
export async function planTeksRetrieval(
  input: ClassifyInput,
  modelId: string = CLASSIFY_MODEL_ID,
) {
  const started = performance.now();
  const result = await generateObject({
    model: getModel(modelId),
    schema: RetrievalPlanSchema,
    schemaName: 'TeksRetrievalPlan',
    schemaDescription: 'Search plan for finding relevant Texas TEKS standards.',
    instructions: `You prepare K-12 test questions for standards retrieval. Transcribe the
question accurately, identify the skill without solving it, and produce concise
search terms that resemble curriculum/standards language. For multiple-choice
items, classify the cognitive distinction required to separate the correct
answer from the plausible distractors—not merely the topic illustrated by the
correct option. Your grade is only a retrieval hint; a later step will choose
from authoritative TEKS records.`,
    messages: [{ role: 'user', content: plannerContent(input) }],
    temperature: 0,
  });

  return {
    plan: result.object,
    model: result.response.modelId || modelId,
    latencyMs: Math.round(performance.now() - started),
    responseId: result.response.id,
    usage: result.usage,
  };
}

/**
 * Let the model investigate official Texas sources. This is intentionally
 * supporting evidence: the final selection is still constrained to database
 * candidates, so a search result cannot smuggle in an invented TEKS code.
 */
export async function researchOfficialTeks(
  plan: RetrievalPlan,
  modelId: string = CLASSIFY_MODEL_ID,
): Promise<WebResearch> {
  if (process.env.AI_WEB_LOOKUP === 'false') {
    return {
      text: '',
      sources: [],
      model: modelId,
      latencyMs: 0,
      usage: null,
      error: 'Disabled by AI_WEB_LOOKUP=false',
    };
  }

  const started = performance.now();
  try {
    const result = await generateText({
      model: getResponsesModel(modelId),
      tools: {
        web_search: openai.tools.webSearch({
          externalWebAccess: true,
          searchContextSize: 'low',
          filters: {
            allowedDomains: ['tea.texas.gov', 'texreg.sos.state.tx.us'],
          },
          userLocation: {
            type: 'approximate',
            country: 'US',
            region: 'Texas',
            timezone: 'America/Chicago',
          },
        }),
      },
      toolChoice: { type: 'tool', toolName: 'web_search' },
      instructions: `You are researching how an assessment question is normally
classified under the Texas Essential Knowledge and Skills. Search official TEA
or Texas Administrative Code sources only. Return a concise evidence memo with
the most plausible exact TEKS codes, their grade/course, and why the tested
skill matches. For multiple-choice items, the assessed skill is the distinction
needed to reject the distractors, not just the isolated fact shown by the right
option. Do not answer the student's question. If evidence is ambiguous, say so;
never invent a code.`,
      prompt: [
        `Question: ${plan.normalizedQuestion}`,
        `Likely subject: ${plan.subject}`,
        `Skill: ${plan.skill}`,
        `Search terms: ${plan.searchTerms.join(', ')}`,
      ].join('\n'),
      temperature: 0,
    });

    return {
      text: result.text,
      sources: result.sources
        .filter((source) => source.sourceType === 'url')
        .map((source) => ({
          url: source.url,
          title: source.title ?? null,
        })),
      model: result.response.modelId || modelId,
      latencyMs: Math.round(performance.now() - started),
      usage: result.usage,
    };
  } catch (error) {
    // Internet lookup improves recall but should not make the local RAG path
    // unavailable during a transient provider/search outage.
    return {
      text: '',
      sources: [],
      model: modelId,
      latencyMs: Math.round(performance.now() - started),
      usage: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in',
  'is', 'it', 'of', 'on', 'or', 'the', 'this', 'to', 'what', 'which', 'with',
  'student', 'students', 'question', 'grade', 'teks', 'texas',
]);

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

/**
 * Retrieve a small candidate set from the authoritative table. The corpus is
 * intentionally small today, so deterministic in-memory scoring keeps fuzzy
 * teacher language useful; the table also has a GIN full-text index for the
 * ingestion/scaling path documented in README.
 */
export async function retrieveTeksCandidates(
  plan: RetrievalPlan,
  research: WebResearch,
  limit = 10,
): Promise<RetrievedTeks[]> {
  const rows = await db.select().from(teksStandards);
  const queryTokens = tokens(
    [plan.normalizedQuestion, plan.skill, ...plan.searchTerms, research.text].join(' '),
  );
  const mentionedCodes = new Set(
    (research.text.match(/\b(?:[A-Z0-9]{1,4}\.)?\d{1,2}[A-Z]\b/gi) ?? [])
      .map((code) => code.toUpperCase()),
  );

  return rows
    .map((row) => {
      const rowTokens = tokens(`${row.searchText} ${row.studentExpectation} ${row.description}`);
      let score = 0;
      for (const token of queryTokens) {
        if (rowTokens.has(token)) score += 1;
      }
      if (row.subject === plan.subject) score += 8;
      if (row.gradeLevel === plan.estimatedGrade) score += 3;
      else if (Math.abs(row.gradeLevel - plan.estimatedGrade) === 1) score += 1;
      if (mentionedCodes.has(row.code.toUpperCase())) score += 25;
      return { ...row, retrievalScore: score };
    })
    .sort(
      (a, b) =>
        b.retrievalScore - a.retrievalScore ||
        a.gradeLevel - b.gradeLevel ||
        a.code.localeCompare(b.code),
    )
    .slice(0, limit);
}
