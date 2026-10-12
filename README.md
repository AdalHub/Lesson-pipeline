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

**Why two stages instead of one:** splitting keeps each job focused, makes classification auditable on its own (retrieval evidence, brief rationale, model and latency are stored), and lets the lesson prompt target the selected grade. This is a design choice, not proof that two prompts always outperform one. Stage 1 uses several provider operations internally—planning, official-source research, and constrained selection—but remains one business stage with one persisted classification output.

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
npm run teks:import               # add the versioned TEA catalog expansion
npm run dev                       # http://localhost:3000
```

Useful checks:

```bash
npm run typecheck                 # tsc --noEmit
npm test                          # deterministic schema, grounding and catalog assertions; no secrets
npm run test:integration          # isolated local Postgres; TEST_DATABASE_URL required
npm run build
npm run smoke:classify            # call 1 on five questions, grades 2-10
npm run smoke:generate            # call 1 + call 2, grade 2 and grade 10 lessons
npm run smoke:pipeline            # lesson.generate end to end, then reads the three rows back
npm run smoke:determinism         # same question N times, reports grade/TEKS distribution
npm run smoke:ui                  # headless Chrome: text, screenshot upload, paste, history
npm run smoke:live                # HTTP + real AI + persistence; BASE_URL required for production
```

`smoke:ui` needs the app running on `:3000` and Google Chrome installed. To exercise the failure path:

```bash
AI_CLASSIFY_MODEL=no-such-model node --env-file=.env.local --import tsx scripts/pipeline-smoke.ts fail
```

`npm test` needs neither Postgres nor an AI key. Integration tests use fake AI providers
with real Drizzle/tRPC/Postgres, migrate automatically, and refuse any database other
than `localhost/lesson_pipeline_test` (or `127.0.0.1`). Set `TEST_DATABASE_URL` to that
dedicated database. They assert successful text/image persistence, both failure stages,
invalid input/output rejection, NOT_FOUND, and stable cursor pagination.

`.github/workflows/ci.yml` runs tests, lint, typecheck and production build with an
isolated Postgres service on every push/PR **once this repo is connected to GitHub**.
No remote is currently configured; a workflow file is not evidence of a hosted CI run.
Real-provider scripts cost API usage; UI/live checks save demo records. Older
`smoke:classify`, `smoke:generate`, and `smoke:determinism` scripts are diagnostic
reports, not exhaustive accuracy tests. Do not confuse mock tests with AI quality evaluation.

## Deploying to Vercel

1. Create a Neon project and connect it to the Vercel project. Use the pooled
   `DATABASE_URL` for application traffic and `DATABASE_URL_UNPOOLED` for
   Drizzle migrations.
2. `vercel login`, then `vercel link` in this directory.
3. Set `DATABASE_URL` and `OPENAI_API_KEY` in the Vercel project (`vercel env add`).
4. Run migrations and the catalog import against Neon: `npm run db:migrate`, then `npm run teks:import`.
5. `vercel --prod`.

**Live URL:** [https://lesson-pipeline.vercel.app](https://lesson-pipeline.vercel.app)

See `READINESS.md` for the latest verification results, Palmer requirement audit,
and remaining limitations. Earlier prototype results in `DECISIONS.md` are historical.

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
tests/                   offline unit and real-Postgres integration tests
data/                    versioned TEA expectations with source document hashes
DECISIONS.md             every non-obvious call made while building, with reasons
PROJECT_WALKTHROUGH.md   code-level architecture and interview guide
SPEC.md                  the build spec
```

## What I'd do next with more time

- **Complete corpus ingestion.** The catalog now includes 593 additional lettered ELAR/social-studies expectations for grades 1–5, extracted from current TEA chapter PDFs (2017 ELAR / 2022 social studies adoption). It remains partial: math/science are curated subsets, K and secondary ELAR/social studies are not imported, and standalone non-lettered expectations are excluded. Roman-numeral details remain inside their parent expectation. `scripts/extract-teks.py` (pypdf) reproduces the JSON snapshot; source SHA-256 hashes make changes reviewable. `teks:import` validates and inserts transactionally/idempotently; it does not overwrite existing records.
- **Evaluation set.** A few dozen labelled questions per grade band with a script that reports grade accuracy and TEKS accuracy per model, so prompt and model changes are measured rather than eyeballed.
- **Stream the lesson** so the second stage renders progressively instead of after a 5-7 s wait.
- **Blob storage for screenshots** instead of base64 data URLs in Postgres.
- **Re-run buttons** on the lesson page: re-classify, or regenerate the lesson from the existing classification, both as new rows.
- **Teacher controls:** override the detected grade before generation, pick lesson length, export to PDF or Google Docs.

## Demo scope and safety

This is a public, shared-history demonstration, not a private student-record system.
Do not upload names, private student information, or sensitive documents. It has no
authentication, per-user isolation, or application rate limiting. Before public-scale
use, add those controls and a provider budget limit. Grade alignment is an estimate,
not a student placement assessment; TEKS skills overlap across grades. Catalog
validation prevents invented *selected codes*, not all incorrect semantic matches.

Demo replacement is recoverable: `scripts/manage-demos.ts snapshot` creates an ignored
JSON backup; `delete-snapshot <exact backup path>` removes only those IDs and their
cascading outputs; `restore <same path>` restores them. New arrivals are not deleted.
