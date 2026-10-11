import { TRPCError } from '@trpc/server';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { classifications, lessons, submissions } from '@/server/db/schema';
import { publicProcedure, router } from '../trpc';

const PREVIEW_LENGTH = 140;

function previewOf(rawText: string | null, inputType: 'text' | 'image') {
  if (inputType === 'image') return '[screenshot]';
  const trimmed = (rawText ?? '').replace(/\s+/g, ' ').trim();
  return trimmed.length > PREVIEW_LENGTH
    ? trimmed.slice(0, PREVIEW_LENGTH - 1) + '...'
    : trimmed;
}

export const lessonRouter = router({
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
