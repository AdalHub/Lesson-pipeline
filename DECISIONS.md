# DECISIONS.md

Routine decisions made while building, per SPEC.md §0. Newest at the bottom.

**Current readiness audit:** see `READINESS.md`. Historical prototype notes below
do not describe every current implementation detail (especially Paper, catalog
coverage, request count, latency and upload size).

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

## Milestone 8 — image input

- **Screenshots go to both AI calls as a `file` part with the media type parsed from the data URL** (`src/server/ai/parts.ts`). AI SDK 7 deprecates the `image` part; `file` with `mediaType: image/*` is the supported form and worked identically in testing (a rendered worksheet PNG classified as grade 6, TEKS 6.7A, with a full lesson).
- **The "real screenshot" for verification is produced by the UI smoke script itself**: it renders a worksheet-style HTML question in headless Chrome and screenshots it to PNG, then uploads that file through the real file input and also injects it through a synthetic clipboard paste event. No hand-made fixture image is committed.
- **Progress polling starts 1.2 s after submit** so the first `getById` lands after the submission row exists; previously the first poll returned a 404 that showed up in the browser console. The tRPC route also stops logging NOT_FOUND / BAD_REQUEST, since those are client-side conditions.

## Milestone 9 — deploy

- **Deployed to Vercel:** [https://lesson-pipeline.vercel.app](https://lesson-pipeline.vercel.app). The linked project is `adals-projects-42d1862b/lesson-pipeline`.
- **Neon is provisioned through Vercel Marketplace.** Application traffic uses the pooled `DATABASE_URL`; `drizzle.config.ts` prefers `DATABASE_URL_UNPOOLED` for schema migrations. The committed migration was applied and all three tables were verified directly.
- **The OpenAI key is a Vercel sensitive secret** for Production, Preview and Development. It was copied from the existing gitignored `.env.local` value and is never printed or committed.
- **Production smoke testing passed:** grade-2 text → `2.4C`, screenshot upload → grade 6 / `6.7A`, clipboard paste preview, grade-10 text → `G.12E`, history click-through and hidden-answer interaction. A separate equal-groups question classified as grade 3 / `3.4K`.
- **Production persistence was verified:** four submissions, four classifications and four lessons; zero classification or lesson rows were missing `model` or `latencyMs`.
- **No `vercel.json` added.** Next.js needs none; the tRPC route's `maxDuration = 120` covers the long request. If the Vercel plan caps function duration below that, lower it or move to streaming.
- **Vercel Standard Protection is enabled.** The generated deployment URL is authenticated, while the production alias above is public and was verified from a fresh headless browser session.

## Milestone 10 — authoritative TEKS retrieval and web grounding

- **This supersedes the Milestone 4 prompt-anchor implementation.** The old `teks.ts` landmark prompt and `reconcileGrade` path were removed; the recorded Milestone 4 notes remain above as history of the measured prototype.
- **Classification is now a grounded stage, not a free-form TEKS recall prompt.** A first structured operation transcribes/analyzes the question, OpenAI's provider-hosted `web_search` tool checks official TEA/TAC sources, Postgres retrieves ten plausible standards, and the final structured operation must copy one retrieved `subject:code` key or return `unknown`.
- **The model never supplies grade, subject, or description for a selected code.** Those fields are hydrated from the chosen `teks_standards` row. A hallucinated or altered candidate key fails closed to `unknown`, so three samples cannot agree on an invented code.
- **Web search is supporting evidence, not the authority.** It is domain-restricted to `tea.texas.gov` and `texreg.sos.state.tx.us`; URLs and the evidence memo are persisted in `classifications.raw_response` and rendered as clickable sources. A search outage is non-fatal because database retrieval still runs.
- **Postgres full-text infrastructure, no separate vector database.** The corpus is small enough that deterministic token overlap, subject, estimated grade, and exact web-mentioned codes give useful ranking today. A GIN `to_tsvector` index is present for the complete-corpus ingestion path.
- **The initial corpus is intentionally curated rather than falsely claiming completeness.** It covers high-value math pathways plus verified science expectations. Unsupported skills return `unknown`; the next ingestion job should load every current and superseded standard from TEA.
- **Grounding corrected the evaluation itself.** The old smoke fixture labelled physical-versus-chemical change as grade 5. Official TEA progression places the explicit distinction at grade 7, current TEKS `7.6C`; the corpus and expected test label were corrected.
- **Multiple-choice retrieval uses the distractor distinction, not just the correct option.** A live production test initially collapsed “physical vs. chemical change” to the correct option's narrower topic (“ice melting,” `3.6C`). The planner, web researcher, and selector now explicitly classify the cognitive distinction required to reject all distractors. The same item then selected `7.6C` unanimously in 3/3 samples.

## Milestone 11 — reproducible validation and broader coverage

- **593 published expectations imported, not generated.** ELAR and social-studies grades 1–5 were extracted programmatically from current TEA chapter PDFs, with source hashes and a committed JSON snapshot. Import is transactional and idempotent; existing math/science records remain. Scope/exclusions are in `data/README.md`.
- **Real assertions replace “looks successful” as the acceptance bar.** Offline unit tests cover input/structured output, retrieval code normalization, subject isolation, hydration, voting and ambiguity. Isolated Postgres tests inject deterministic provider results into the real tRPC router and assert persistence, both failure stages, invalid data, NOT_FOUND and cursor ties. Public-URL smoke tests additionally exercise real OpenAI, web evidence, HTTP transport and browser interactions. These layers measure different things; mocks do not prove AI accuracy.
- **No production DB in ordinary tests.** The test launcher refuses non-local integration URLs and clears the OpenAI key for test processes. CI configuration has a disposable Postgres service. There is no Git remote yet, so hosted CI has not run.
- **Candidate enum is constrained at generation time.** Zod's enum is built from retrieved keys plus `unknown`; hydration revalidates it. Code spelling variants such as `2.4.C` and `2.4(C)` now normalize for retrieval. Ranking filters by planned subject, preventing same-code collisions across subjects. This also makes planner subject errors a known failure mode; `unknown` is preferable to inventing a match.
- **Search isn't ground truth.** A live reading check found that the web memo misidentified a section and favored adult-assisted grade-1 inference, despite independent grade-2–5 candidates. The planner now retains the entire passage/options, the selector is instructed not to invent adult assistance, and web prose no longer adds lexical ranking noise. Repeated expectations across grades force low confidence in application code. This is a regression safeguard, not proof of calibrated confidence or perfect classification.
- **Bounded runtime/cost.** Sampling is clamped to 1–5; partial failures or voting ties reduce confidence. Planner/search/selection/generation have 20/30/20/40-second deadlines respectively; search timeout falls back to local retrieval. The request can still fail, and saved partial rows make the failure inspectable.
- **Upload cap corrected.** The old 6-million-character claim was wrong for Vercel's request limit. Both UI and API now cap the data URL at 4 million characters, leaving JSON overhead. Unsupported image formats are rejected before submission.
- **Honest UI.** Grade is an estimated alignment, confidence is visible, unknown standards do not claim a selected record, and the upload form warns that history is public/shared.
- **Recoverable demo replacement.** Old submissions and both output tables are archived in ignored JSON before deleting only their exact IDs. Restore is supported; records created after the snapshot are preserved. Backups, env files and downloaded PDF scratch files are explicitly excluded from Vercel uploads.

## Milestone 12 — public source and engineering handoff

- **Preserved history, not a new first commit.** Published the existing milestone commits to `AdalHub/Lesson-pipeline`, renamed the branch to `main`, and connected the existing Vercel project to GitHub. Earlier notes about no remote/hosted CI describe the state at that milestone, not the current state.
- **Hosted CI verified.** [Run 38203785177](https://github.com/AdalHub/Lesson-pipeline/actions/runs/38203785177) passed unit tests, disposable-Postgres integration tests, lint, typecheck and build. The workflow has read-only repository permissions and no production secrets.
- **Public source, private correspondence.** Added a focused publication audit for known local credentials, credential patterns, private paths and copied correspondence. It passed, but is not a comprehensive security scanner. The report is public; the Palmer email draft and recovery backups are ignored locally and excluded from deployment. Existing author metadata is retained.
- **Document the limits, not just the success path.** `PROJECT_REPORT.md` explains actual retrieval, schemas, model operation count, failures that shaped prompts, catalog coverage and what the tests cannot prove. A valid catalog selection is not a guarantee of correct grade inference.

## Milestone 13 — learning-science lesson redesign

Prompted by staff-engineer review: the first lesson format was a schema around
whatever the model produced, not a design built on how students learn. Classification
code was left unchanged; it is being reworked separately. The reasoning for the new
structure is in `LESSON_DESIGN.md`.

- **The lesson is now a fixed pedagogical frame, not a free-form document.** Seven
  screens (the reference deck's eight steps; practice question and answered state
  share a screen): title, big idea, varied examples, strategy with a non-example,
  guided practice, quiz, recap. The model fills the frame; the order and fields are
  not its choice.
- **A plan is the first field of the output.** Learning goal, prior knowledge, the
  single core misconception and success criteria are written before any slide, and
  the non-example, wrong options, a quiz item and the recap warning must serve it.
  One structured call, not a plan-then-write chain, to keep latency flat.
- **Structure is enforced in the Zod schema** (one correct option, a non-example with
  a failing part, valid `answerIndex`, at least one quiz item aimed at the
  misconception). **Pedagogy is checked in code** (`lesson-quality.ts`): new items
  not copies of the question, feedback that explains, a quiz that cannot be passed by
  always tapping the same answer, no markup or emoji, reading level by grade. `fix`
  findings buy one corrective regeneration; `warn` findings are stored only.
- **The better of two drafts is kept, never the worse.** A failed repair attempt
  keeps the first draft and records `repairFailure`. Generation has an 85 s budget so
  two attempts fit under the route's 120 s limit.
- **Answer positions are normalised after generation**, persisted, and not random per
  view: guided options are shuffled, and quiz choices are shuffled when they are
  phrases (short pairs such as "Compound" / "Not" keep their order). Models put the
  correct choice first or in the middle far more often than chance.
- **Two checks were wrong the first time and were corrected from real output.** The
  duplicate check stripped maths symbols, so `6 + 5` and `6 - 5` matched. The
  "copied from the question" check flagged a shared question stem. Both are now
  covered by regression tests. A third, "joining word already on the card", is
  advisory because numbers and punctuation legitimately appear there.
- **Annotation roles are tolerated, not retried.** Models often annotate a role they
  did not use. That used to cost a full regeneration; the schema now accepts it, the
  legend skips it, and the quality layer warns.
- **Old rows keep working.** `lessons.content` is `jsonb`, so there is no migration.
  `StoredLessonSchema` accepts both shapes, `isSlideLesson` picks the renderer, and
  the previous view lives on as `LegacyLessonView`. Verified against a real stored
  lesson on a local dev server using read-only database access.
- **The interface was designed in Paper and implemented from its export.** Thirteen
  artboards on a "Lesson Slides" page of the Lesson Pipeline UI file, with tokens
  prefixed `--color-slide-*` registered in `globals.css` so exported classes work
  unchanged. The reference file could not be cloned or exported (edit access is
  required), so its tokens and fonts were read through the MCP and its layout
  rebuilt from the screenshots. Paper's free-tier weekly MCP limit then ran out
  after six of thirteen exports; the rest were ported from the HTML written to
  Paper. Paper Desktop has to be running for the MCP to respond.
- **Accessibility changes from the reference, on purpose.** Brand teal is 2.9:1 on
  white, so text, control borders and filled buttons use `#00708E` (5.7:1) and the
  brand teal is decorative only. The title gradient is dark behind the copy and
  light behind the mascot. Every colour signal also has an icon or word.
- **Fonts are loaded only on lesson pages** (`next/font/google` declared in the
  player, not the root layout).
- **Evidence, honestly sized.** Five live generations across grades 2 to 10 and
  four subjects, 6 to 16 s each, no fix-level issues remaining, four on the first
  attempt. Average sentence length in student text was 6.4 words at grade 2 and
  11.9 at grade 10 (which also used real notation). 72 offline tests pass, including
  retry behaviour against a mock model. This measures structure, not teaching
  quality and not factual accuracy: no student has used it and no second model has
  checked the content (a grade 10 strategy blurb was muddled).
- **Not run locally:** `npm run test:integration` needs a Postgres instance and the
  development machine had neither Postgres nor a running Docker engine. The router
  and tables are unchanged apart from a widened TypeScript type, and CI runs that
  suite.
