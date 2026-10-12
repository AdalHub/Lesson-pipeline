import { openai } from '@ai-sdk/openai';

/**
 * Model selection for the two pipeline calls. Each can be overridden
 * independently; AI_MODEL overrides both.
 *
 * Default is gpt-4.1 for both: in testing, gpt-4.1-mini knew TEKS codes
 * noticeably worse (invented descriptions, 50/50 grade flips on borderline
 * questions) and the gpt-5 family refused to map codes and ignores
 * temperature, which we need at 0 for repeatable classification.
 */
const FALLBACK_MODEL_ID = 'gpt-4.1';

export const CLASSIFY_MODEL_ID =
  process.env.AI_CLASSIFY_MODEL ?? process.env.AI_MODEL ?? FALLBACK_MODEL_ID;

export const GENERATE_MODEL_ID =
  process.env.AI_GENERATE_MODEL ?? process.env.AI_MODEL ?? FALLBACK_MODEL_ID;

export function getModel(modelId: string) {
  return openai(modelId);
}

/** Responses API model used when the classifier needs provider-hosted tools. */
export function getResponsesModel(modelId: string) {
  return openai.responses(modelId);
}

export { openai };
