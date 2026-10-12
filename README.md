# Lesson Pipeline

Paste a K-12 test question (text or a screenshot) and get back a lesson that teaches a student how to answer that kind of question. The question is first classified against the Texas Essential Knowledge and Skills (TEKS), then a second AI call writes the lesson for that grade level. Both stages are persisted to Postgres so a bad classification can be diagnosed separately from a bad lesson.

## The two-call architecture

```
Input (text or screenshot)
   │
   ▼
CALL 1 — classify (gpt-4.1, temperature 0, 3 samples voted)
   → grade level, subject, TEKS code + description, question type,
     difficulty, key concepts, reasoning
   │
   ▼
CALL 2 — generate (gpt-4.1), receives the classification as explicit input
   → title, objective, prerequisites, explanation (Markdown),
     worked example with step-by-step "why", common mistakes,
     practice problems with hints and hidden answers
   │
   ▼
submissions → classifications → lessons   (Postgres via Drizzle)
```

**Why two calls instead of one:** a single prompt asked to classify *and* teach does both worse. Splitting keeps each prompt focused, makes the classification auditable on its own (its reasoning, model and latency are stored), and lets the lesson prompt be told exactly which grade it is writing for.

**Why TEKS:** "what grade is this?" with no reference point gives inconsistent answers between runs. TEKS is a published, numbered standard the model knows from training, so every grade judgement is anchored to a specific code (`3.4K`, `8.7C`, `G.12E`) rather than a general impression. This is a Texas school, so TEKS over Common Core is deliberate. The prompt also carries a short table of TEKS math landmarks and grade-boundary rules, and three parallel samples are voted on, which made grade assignment repeatable (5/5 identical across five questions from grade 2 to 10).

Both calls use the Vercel AI SDK's `generateObject` with zod schemas (`src/server/ai/schemas.ts`), so the output is typed and validated before it touches the database.

## Stack

Next.js 15 (App Router, TypeScript, `src/`) · Tailwind CSS v4 · Postgres (Neon in production, Docker locally) · Drizzle ORM · tRPC v11 · zod · Vercel AI SDK with OpenAI · Vercel.

## Running locally

```bash
# 1. Postgres (any Postgres 14+ works; this starts one in Docker)
docker run -d --name lesson-pipeline-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=lesson_pipeline -p 5432:5432 postgres:16-alpine

# 2. Env
cp .env.example .env.local        # then fill in OPENAI_API_KEY

# 3. Install, migrate, run
npm install
npm run db:migrate
npm run dev                       # http://localhost:3000
```

Useful checks:

```bash
npm run typecheck                 # tsc --noEmit
npm run build
npm run smoke:classify            # call 1 on five questions, grades 2-10
npm run smoke:generate            # call 1 + call 2, grade 2 and grade 10 lessons
npm run smoke:pipeline            # lesson.generate end to end, then reads the three rows back
npm run smoke:determinism         # same question N times, reports grade/TEKS distribution
npm run smoke:ui                  # headless Chrome: text, screenshot upload, paste, history
```

`smoke:ui` needs the app running on `:3000` and Google Chrome installed. To exercise the failure path:

```bash
AI_CLASSIFY_MODEL=no-such-model node --env-file=.env.local --import tsx scripts/pipeline-smoke.ts fail
```

## Deploying to Vercel

1. Create a Neon project and connect it to the Vercel project. Use the pooled
   `DATABASE_URL` for application traffic and `DATABASE_URL_UNPOOLED` for
   Drizzle migrations.
2. `vercel login`, then `vercel link` in this directory.
3. Set `DATABASE_URL` and `OPENAI_API_KEY` in the Vercel project (`vercel env add`).
4. Run the migration against Neon once: `npm run db:migrate`.
5. `vercel --prod`.

**Live URL:** [https://lesson-pipeline.vercel.app](https://lesson-pipeline.vercel.app)

The production deployment was verified through the real UI on October 11,
2026: grade-2 and grade-10 text questions, a generated worksheet screenshot
uploaded through the file input, clipboard image paste, history, and lesson
click-through all passed. Neon contained four complete submission →
classification → lesson triplets after testing, with no missing `model` or
`latencyMs` fields.

## Project layout

```
src/app/                 pages: / (input), /lessons (history), /lessons/[id] (lesson), /api/trpc
src/components/          QuestionInput, LessonView, ClassificationBadge
src/server/ai/           schemas.ts, classify.ts, generate.ts, teks.ts (anchors), model.ts
src/server/api/          tRPC context, root router, routers/lesson.ts, pipeline-error.ts
src/server/db/           Drizzle schema + client
src/trpc/                React Query client provider and RSC caller
drizzle/                 migrations
scripts/                 smoke tests
DECISIONS.md             every non-obvious call made while building, with reasons
PROJECT_WALKTHROUGH.md   code-level architecture and interview guide
SPEC.md                  the build spec
```

## What I'd do next with more time

- **A real TEKS lookup.** Load the published TEKS student expectations into a table and have the classifier pick from candidates (or validate its code against it). Today the model's own recall is anchored by a short hand-written landmark table; it is good for math and weaker for ELAR and social studies codes.
- **Evaluation set.** A few dozen labelled questions per grade band with a script that reports grade accuracy and TEKS accuracy per model, so prompt and model changes are measured rather than eyeballed.
- **Stream the lesson** so the second stage renders progressively instead of after a 5-7 s wait.
- **Blob storage for screenshots** instead of base64 data URLs in Postgres.
- **Re-run buttons** on the lesson page: re-classify, or regenerate the lesson from the existing classification, both as new rows.
- **Teacher controls:** override the detected grade before generation, pick lesson length, export to PDF or Google Docs.
