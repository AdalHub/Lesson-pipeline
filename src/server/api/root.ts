import { sql } from 'drizzle-orm';
import { createCallerFactory, publicProcedure, router } from './trpc';
import { lessonRouter } from './routers/lesson';

export const appRouter = router({
  /** Liveness check that also proves the DB connection works. */
  health: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.execute(sql`select now() as now`);
    const row = result.rows[0] as { now: string | Date } | undefined;
    return {
      ok: true,
      db: row ? 'connected' : 'no-rows',
      dbTime: row?.now ?? null,
      serverTime: new Date(),
    };
  }),
  lesson: lessonRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
