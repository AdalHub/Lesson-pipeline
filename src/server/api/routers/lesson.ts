import { TRPCError } from '@trpc/server';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { classify, type ClassifyResult } from '@/server/ai/classify';
import { generateLesson, type GenerateResult } from '@/server/ai/generate';
import { classifications, lessons, submissions } from '@/server/db/schema';
import { PipelineError, type PipelineStage } from '../pipeline-error';
import { publicProcedure, router } from '../trpc';

const PREVIEW_LENGTH = 140;

/** Max accepted data URL length (~6 MB of base64, under Vercel's body limit). */
const MAX_IMAGE_DATA_URL_LENGTH = 6_000_000;

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

export const GenerateInputSchema = z
  .object({
    inputType: z.enum(['text', 'image']),
    text: z.string().trim().min(1).max(10_000).optional(),
    imageDataUrl: z
      .string()
      .max(MAX_IMAGE_DATA_URL_LENGTH, 'Image is too large (max ~4 MB)')
      .regex(IMAGE_DATA_URL, 'Expected a base64 PNG, JPEG, WebP or GIF data URL')
      .optional(),
  })
  .refine(
    (d) => (d.text ? 1 : 0) + (d.imageDataUrl ? 1 : 0) === 1,
    'Provide exactly one of text or imageDataUrl',
  )
  .refine(
    (d) => (d.inputType === 'text' ? !!d.text : !!d.imageDataUrl),
    'inputType does not match the input provided',
  );

function previewOf(rawText: string | null, inputType: 'text' | 'image') {
  if (inputType === 'image') return '[screenshot]';
  const trimmed = (rawText ?? '').replace(/\s+/g, ' ').trim();
  return trimmed.length > PREVIEW_LENGTH
    ? trimmed.slice(0, PREVIEW_LENGTH - 1) + '...'
    : trimmed;
}

function failStage(stage: PipelineStage, submissionId: string, cause: unknown) {
  const pipelineError = new PipelineError(stage, submissionId, cause);
  console.error(`[pipeline] ${pipelineError.message}`);
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: pipelineError.message,
    cause: pipelineError,
  });
}

export const lessonRouter = router({
  /**
   * The pipeline: insert submission -> classify -> insert classification
   * -> generate (with the classification as input) -> insert lesson.
   * Each stage persists before the next runs, so a failure in a later stage
   * never loses earlier rows.
   */
  generate: publicProcedure
    .input(GenerateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const question =
        input.inputType === 'text'
          ? { kind: 'text' as const, text: input.text! }
          : { kind: 'image' as const, imageDataUrl: input.imageDataUrl! };

      const [submission] = await ctx.db
        .insert(submissions)
        .values({
          inputType: input.inputType,
          rawText: question.kind === 'text' ? question.text : null,
          imageUrl: question.kind === 'image' ? question.imageDataUrl : null,
        })
        .returning();
      if (!submission) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create submission',
        });
      }

      // CALL 1 — classify
      let classified: ClassifyResult;
      try {
        classified = await classify(question);
      } catch (err) {
        throw failStage('classify', submission.id, err);
      }

      const c = classified.classification;
      const [classificationRow] = await ctx.db
        .insert(classifications)
        .values({
          submissionId: submission.id,
          gradeLevel: c.gradeLevel,
          gradeLevelConfidence: c.gradeLevelConfidence,
          subject: c.subject,
          teksStandard: c.teksStandard,
          teksDescription: c.teksDescription,
          questionType: c.questionType,
          difficulty: c.difficulty,
          keyConcepts: c.keyConcepts,
          reasoning: c.reasoning,
          model: classified.model,
          latencyMs: classified.latencyMs,
          rawResponse: classified.rawResponse,
        })
        .returning();
      if (!classificationRow) {
        throw failStage(
          'classify',
          submission.id,
          new Error('Failed to persist classification'),
        );
      }

      // CALL 2 — generate, with call 1's output as explicit input
      let generated: GenerateResult;
      try {
        generated = await generateLesson({ question, classification: c });
      } catch (err) {
        throw failStage('generate', submission.id, err);
      }

      const [lessonRow] = await ctx.db
        .insert(lessons)
        .values({
          submissionId: submission.id,
          classificationId: classificationRow.id,
          title: generated.lesson.title,
          content: generated.lesson,
          model: generated.model,
          latencyMs: generated.latencyMs,
        })
        .returning();
      if (!lessonRow) {
        throw failStage(
          'generate',
          submission.id,
          new Error('Failed to persist lesson'),
        );
      }

      return {
        submissionId: submission.id,
        classification: classificationRow,
        lesson: lessonRow,
      };
    }),

  /**
   * Fetch one submission with its latest classification and lesson.
   * `id` is the submission id: the submission row always exists, even when a
   * later stage failed, so the page can show partial state.
   */
  getById: publicProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.query.submissions.findFirst({
        where: eq(submissions.id, input.id),
        with: {
          classifications: {
            orderBy: desc(classifications.createdAt),
            limit: 1,
          },
          lessons: {
            orderBy: desc(lessons.createdAt),
            limit: 1,
          },
        },
      });

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      const { classifications: cls, lessons: lsn, ...sub } = submission;
      return {
        submission: sub,
        classification: cls[0] ?? null,
        lesson: lsn[0] ?? null,
      };
    }),

  /** Newest-first history, cursor-paginated by (createdAt, id). */
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          cursor: z.uuid().optional(),
        })
        .default({ limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor } = input;

      let cursorFilter;
      if (cursor) {
        const cursorRow = await ctx.db.query.submissions.findFirst({
          where: eq(submissions.id, cursor),
          columns: { id: true, createdAt: true },
        });
        if (cursorRow) {
          cursorFilter = or(
            lt(submissions.createdAt, cursorRow.createdAt),
            and(
              eq(submissions.createdAt, cursorRow.createdAt),
              lt(submissions.id, cursorRow.id),
            ),
          );
        }
      }

      const rows = await ctx.db.query.submissions.findMany({
        where: cursorFilter,
        orderBy: [desc(submissions.createdAt), desc(submissions.id)],
        limit: limit + 1,
        columns: { id: true, inputType: true, rawText: true, createdAt: true },
        with: {
          classifications: {
            orderBy: desc(classifications.createdAt),
            limit: 1,
            columns: {
              gradeLevel: true,
              gradeLevelConfidence: true,
              subject: true,
              teksStandard: true,
            },
          },
          lessons: {
            orderBy: desc(lessons.createdAt),
            limit: 1,
            columns: { id: true, title: true },
          },
        },
      });

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      return {
        items: page.map((row) => ({
          id: row.id,
          inputType: row.inputType,
          preview: previewOf(row.rawText, row.inputType),
          createdAt: row.createdAt,
          classification: row.classifications[0] ?? null,
          lesson: row.lessons[0] ?? null,
        })),
        nextCursor: hasMore ? page[page.length - 1]!.id : null,
      };
    }),
});
