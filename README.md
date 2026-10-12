# Lesson Pipeline

Paste a K-12 test question (text or a screenshot) and get back a lesson that teaches a student how to answer that kind of question. The question is first classified against the Texas Essential Knowledge and Skills (TEKS), then a second AI call writes the lesson for that grade level. Both stages are persisted to Postgres so a bad classification can be diagnosed separately from a bad lesson.

## The two-stage architecture

```
Input (text or screenshot)
   │
   ▼
STAGE 1 — grounded classification
   → analyze/OCR the question into curriculum search terms
   → use OpenAI web search against official TEA/TAC domains
   → retrieve 10 plausible rows from Neon `teks_standards`
   → 3 parallel constrained selections (the model can only choose a row)
   → grade, subject and description come from the selected database record
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

**Why two stages instead of one:** a single prompt asked to classify *and* teach does both worse. Splitting keeps each job focused, makes the classification auditable on its own (its retrieval evidence, reasoning, model and latency are stored), and lets the lesson prompt be told exactly which grade it is writing for. Stage 1 uses several provider operations internally—planning, official-source research, and constrained selection—but it remains one business stage with one persisted classification output.

**Why TEKS:** "what grade is this?" with no reference point gives inconsistent answers. TEKS is the published Texas curriculum standard, so every judgement is anchored to a specific expectation (`3.4K`, `8.7C`, `G.12E`) rather than a general impression. The authoritative candidate rows live in Postgres. Official web evidence improves recall across versions, but it cannot directly become the answer: the selector must copy a retrieved `subject:code` key, and the application rejects anything else. Three parallel constrained selections are still voted for residual consistency.

Structured model outputs use the Vercel AI SDK with Zod schemas, and web research uses the provider-hosted OpenAI `web_search` tool restricted to `tea.texas.gov` and `texreg.sos.state.tx.us`. The complete plan, cited URLs, candidate list, scores, and votes are stored in `classifications.raw_response` and shown on the lesson page.

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
src/server/ai/           schemas, retrieval/web research, constrained classification, generation
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

- **Complete corpus ingestion.** The retrieval architecture and initial official math/science catalog are live; the next step is importing every current ELAR, science, social studies, and math expectation and retaining superseded versions.
- **Evaluation set.** A few dozen labelled questions per grade band with a script that reports grade accuracy and TEKS accuracy per model, so prompt and model changes are measured rather than eyeballed.
- **Stream the lesson** so the second stage renders progressively instead of after a 5-7 s wait.
- **Blob storage for screenshots** instead of base64 data URLs in Postgres.
- **Re-run buttons** on the lesson page: re-classify, or regenerate the lesson from the existing classification, both as new rows.
- **Teacher controls:** override the detected grade before generation, pick lesson length, export to PDF or Google Docs.
