export type PipelineStage = 'classify' | 'generate';

const STAGE_LABEL: Record<PipelineStage, string> = {
  classify: 'Classification',
  generate: 'Lesson generation',
};

function messageOf(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string') return cause;
  return 'unknown error';
}

/**
 * Thrown when one of the two AI calls fails. Carries the stage and the
 * submission id so the client can show what was persisted before the
 * failure (the submission row, and the classification row when stage is
 * "generate").
 */
export class PipelineError extends Error {
  readonly stage: PipelineStage;
  readonly submissionId: string;

  constructor(stage: PipelineStage, submissionId: string, cause: unknown) {
    super(`${STAGE_LABEL[stage]} failed: ${messageOf(cause)}`, { cause });
    this.name = 'PipelineError';
    this.stage = stage;
    this.submissionId = submissionId;
  }
}
