# DECISIONS.md

Routine decisions made while building, per SPEC.md §0. Newest at the bottom.

## Milestone 1 — scaffold

- **Repo root is the working directory, not a subfolder.** `create-next-app` refuses the directory name "Adal Marisol" (npm naming rules), so the app was scaffolded into a temp subfolder and moved up. The package name is `lesson-pipeline`.
- **Next.js pinned to the 15.x line** (`create-next-app@15`, resolved to 15.5.27) because the spec says Next 15 exactly. Tailwind v4 came with the scaffold.
- **Turbopack left on for `next dev`** (scaffold default). `next build` also uses `--turbopack` by default in this scaffold; if Vercel's build has trouble with it, drop the flag.
- **OpenAI is the AI provider.** No `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` was in the environment, but an `OPENAI_API_KEY` already existed in two sibling projects on this machine (`agent-openai-12-25/.env`, `agent 12-18-25/.env`). It was copied into `.env.local` here. It is never printed and `.env*` is gitignored.
- **Single `npm install` for the whole stack up front** (drizzle, pg, tRPC v11, react-query v5, zod, ai, @ai-sdk/openai, superjson, react-markdown, remark-gfm; dev: drizzle-kit, @types/pg, tsx, dotenv) to avoid repeated installs at each milestone.

## Milestone 2 — database

- **Local Postgres in Docker for development; Neon for deploy.** No Neon credentials or `neonctl` login exist on this machine and account signup is interactive, so dev runs against `postgres:16-alpine` in a container named `lesson-pipeline-pg` (`postgresql://postgres:postgres@localhost:5432/lesson_pipeline`). The code is driver-compatible with Neon: set `DATABASE_URL` to the Neon pooled connection string and run `npx drizzle-kit migrate`.
- **`pg` + `drizzle-orm/node-postgres` instead of `@neondatabase/serverless`.** The standard driver works against both local Postgres and Neon (Neon speaks normal Postgres over TLS), which keeps dev and prod on one code path. Pool size is capped at 5 for serverless.
- **Migrations are generated and committed** (`drizzle-kit generate` + `drizzle-kit migrate`) rather than `drizzle-kit push`, so the schema history lives in `drizzle/`.
- **`timestamptz` for `createdAt` columns** (spec says `timestamp`); with-timezone is the safer default for a hosted DB.
- **Column names are snake_case in SQL, camelCase in TypeScript** (Drizzle's explicit column-name mapping).
- **`drizzle.config.ts` loads `.env.local` via dotenv** because drizzle-kit does not read Next's env files on its own.

## Milestone 3 — tRPC

- **Classic `createTRPCReact` + `httpBatchLink` with superjson**, provider mounted in the root layout. Server components get a caller from `createCallerFactory` with a React-cached context (`src/trpc/server.ts`).
- **`health` also pings the DB** (`select now()`), so a green health check proves the DB connection, not just the route.
- **`lesson.getById` takes the submission id**, not a lesson id, and returns the latest classification and lesson as nullable fields. The submission row always exists, so a page can show partial state after a mid-pipeline failure.
- **`lesson.list` cursor is the last item's submission id**, paginating on `(createdAt, id)` so ties are stable.
- **`maxDuration = 120`** on the tRPC route handler so Vercel gives the two sequential AI calls enough time.

## Milestone 4 — classification

- **gpt-4.1 is the default classification model.** Measured on the sample set: gpt-4.1-mini split 3/3 between grade 2 and 3 on an equal-groups question and invented TEKS descriptions; gpt-5-mini returned `teksStandard: "unknown"` for everything, split on grade, took 5-8 s per call, and ignores `temperature`. gpt-4.1 with the changes below gave the same grade in 5/5 runs for all five questions.
- **A hand-written TEKS anchor table and grade-boundary rules are in the system prompt** (`src/server/ai/teks.ts`). Math is covered in detail because that is where boundary flips happened (grade 1/2 addition ranges, grade 2/3 equal groups, grade 8/Algebra I). Only codes I am confident in are listed; keep it short rather than complete.
- **Three parallel samples at temperature 0, majority vote on grade, then most common TEKS code.** OpenAI is not deterministic at temperature 0, so voting removes residual flips. Latency is unchanged (parallel) and every sample is stored in `rawResponse` for audit. `AI_CLASSIFY_SAMPLES=1` disables it.
- **The TEKS code's grade overrides `gradeLevel` when they disagree** (`reconcileGrade`), with confidence lowered a notch. This is the spec's own rule ("report the grade that standard belongs to") applied deterministically. `P.*` is not reconciled because Physics and Precalculus share the prefix.
- **`generateObject` is kept even though AI SDK 7 deprecates it** in favour of `generateText` + `Output`. The spec requires it and it works; the SDK logs one deprecation warning per process.
- **Smoke scripts run with `node --env-file=.env.local --import tsx`** so `.env.local` is loaded before any module reads `process.env`.

## Milestone 5 — generation

- **Lessons use gpt-4.1 too, at temperature 0.7.** Quality over cost; both calls can be pointed at different models with `AI_CLASSIFY_MODEL` / `AI_GENERATE_MODEL`.
- **Plain-text math in lessons, no LaTeX**, because the renderer is react-markdown without a math plugin.
- **The worked example and practice problems must be new problems**, not the original question; otherwise the model tends to just solve the input.
- **For screenshot submissions, call 2 receives the image as well as the classification.** The classification schema is fixed by the spec and has no transcription field, so the image is the only way to give the lesson writer the question text.

## Milestone 6 — pipeline

- **Each stage persists before the next starts, with no wrapping transaction.** Partial persistence is the requirement: a failed generation keeps the submission and classification rows.
- **AI failures become `TRPCError` INTERNAL_SERVER_ERROR with `data.pipeline = { stage, submissionId }`** via the error formatter, using a `PipelineError` cause. The client can link to the submission page after a failure.
- **Screenshots are stored as base64 data URLs in `submissions.image_url`.** No blob storage is configured and the spec is a demo; the cap is 6M characters (~4.5 MB) to stay under Vercel's request body limit. Swap for Vercel Blob or S3 if this ever leaves demo scope.

## Milestone 7 — frontend

- **Paper.design was a blocker; the screens are hand-built Tailwind.** Paper's MCP requires the Paper Desktop app installed and running with a file open (it serves the MCP from the desktop process and the install is a one-click "Add to Claude" in its GUI or an interactive plugin install). Paper Desktop is not installed on this machine, there is no account, and this session is non-interactive, so installing and authorizing a desktop app was out of reach. Per SPEC §8, the three screens were built directly: warm "paper" palette, Tailwind v4 theme tokens in `globals.css`, `@tailwindcss/typography` for the Markdown explanation, light and dark via `prefers-color-scheme`.
- **Stage indicator is real, not a timer.** The client generates the submission id (`crypto.randomUUID()`), passes it as an optional `submissionId` on `lesson.generate`, and polls `lesson.getById` every 1.5 s while the mutation is pending. Once a classification row exists, stage 2 is shown as active. No streaming, no extra endpoint.
- **Paste-to-upload listens on `window`**, so pasting a screenshot works anywhere on the page, not only with the textarea focused.
- **Images over 1.5 MB are downscaled client-side** (longest side 1600 px, JPEG 0.85) before upload to stay under the data-URL cap; smaller files are sent as-is to preserve text legibility.
- **Practice answers and hints use native `<details>`**, so they are hidden by default without client JS.
- **History is a server component with a `?cursor=` link** for older pages instead of client-side infinite scroll; invalid cursors are ignored rather than erroring.
- **Lesson and history pages are `force-dynamic`** (they read the DB on every request); the tRPC caller reads request headers, which would make them dynamic anyway.
