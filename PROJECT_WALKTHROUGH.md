# Lesson Pipeline: Fast Technical Walkthrough

This is the code-level map to learn before presenting the project. Start with the 90-second explanation, then use the later sections when someone asks a follow-up.

## The 90-second explanation

The browser accepts exactly one input: question text or a screenshot. The React client sends that input through a typed tRPC mutation to a Next.js route handler. The server immediately inserts a `submissions` row, then makes two separate structured AI calls.

Stage 1 classifies the question against TEKS using retrieval rather than model recall. A structured planning operation reads/OCRs the question and produces standards-language search terms. OpenAI's hosted web-search tool checks official TEA/TAC sources. The app retrieves ten candidate standards from the Neon `teks_standards` table, and three parallel structured selections may copy only one retrieved `subject:code` key or return `unknown`. Grade, subject, and description are then hydrated from that database row—not from model prose—and the validated samples are voted.

The classification is persisted before Call 2 begins. Call 2 receives the original question plus the complete classification as explicit input and returns another Zod-validated object: a grade-appropriate lesson with an objective, explanation, worked example, mistakes, and practice. That lesson is persisted separately. This three-table shape makes failures diagnosable and preserves partial work.

Next.js provides the React UI, server-rendered lesson/history pages, and the `/api/trpc` HTTP route. tRPC gives the browser a type-safe client for server procedures; Zod performs runtime validation; Drizzle maps TypeScript objects to SQL; `pg` maintains the Postgres connection pool. Locally, `DATABASE_URL` points to Postgres on port 5432. In production, it points to Neon Postgres connected to the Vercel project.

## End-to-end data flow

```text
QuestionInput.tsx
  text OR image data URL
          |
          | api.lesson.generate.useMutation(...)
          v
POST /api/trpc/lesson.generate
  Next route.ts -> tRPC appRouter -> lessonRouter.generate
          |
          +--> INSERT submissions
          |
          +--> classify(question)
          |      structured OCR/retrieval plan
          |      OpenAI web_search (official Texas domains only)
          |      retrieve 10 rows from teks_standards
          |      3 parallel constrained candidate selections
          |      database row -> grade/subject/description
          |      ClassificationSchema validates + majority vote
          |
          +--> INSERT classifications
          |
          +--> generateLesson({ question, classification })
          |      1 generateObject call
          |      LessonSchema validates result
          |
          +--> INSERT lessons
          |
          v
return { submissionId, classification, lesson }
          |
          v
browser navigates to /lessons/<submissionId>
          |
          v
Next.js Server Component calls lesson.getById directly
and renders ClassificationBadge + LessonView
```

The client creates the submission UUID before sending the mutation. While the long request is running, it polls `lesson.getById` every 1.5 seconds. When a classification row appears, the UI knows stage 1 finished and changes the progress label to stage 2.

## The structured schemas

The source of truth is `src/server/ai/schemas.ts`.

### Classification output

```ts
{
  reasoning: string;
  gradeLevel: 1..12 integer;
  gradeLevelConfidence: 'high' | 'medium' | 'low';
  subject:
    | 'math'
    | 'reading_language_arts'
    | 'science'
    | 'social_studies'
    | 'other';
  teksStandard: string; // for example "3.4K", or "unknown"
  teksDescription: string;
  questionType:
    | 'multiple_choice'
    | 'short_answer'
    | 'word_problem'
    | 'computation'
    | 'essay'
    | 'other';
  difficulty: 'below_grade' | 'on_grade' | 'above_grade';
  keyConcepts: string[]; // 1 to 5 items
}
```

`reasoning` appears first so the serialized response asks for the rationale before the committed label. Treat this as a prompting aid and an audit field, not a guarantee that it exposes or controls the model's hidden reasoning.

### Lesson output

```ts
{
  title: string;
  objective: string;
  prerequisites: string[];
  explanation: string; // Markdown
  workedExample: {
    problem: string;
    steps: Array<{
      step: string;
      explanation: string; // why the step is taken
    }>; // at least 2
    answer: string;
  };
  commonMistakes: Array<{
    mistake: string;
    whyItHappens: string;
    howToAvoid: string;
  }>; // 1 to 4
  practiceProblems: Array<{
    problem: string;
    hint: string;
    answer: string;
  }>; // 2 to 5
}
```

The AI SDK receives these Zod schemas. If the model response does not match, the call fails instead of letting malformed data enter the database. This is runtime safety; TypeScript alone would disappear after compilation and could not validate a network response.

## What TEKS is, and how classification works

TEKS means Texas Essential Knowledge and Skills. TEKS is the reference hierarchy, not one flat list of UI categories.

The app produces several related labels:

- `subject`: one of five broad application categories.
- `gradeLevel`: grades 1 through 12.
- `teksStandard`: the specific curriculum expectation, such as `3.4K`.
- `questionType`: the format of the question.
- `difficulty`: difficulty relative to the selected grade-level standard.
- `keyConcepts`: short teacher-facing descriptions of the skills.

The decision process in `src/server/ai/classify.ts` and `teks-retrieval.ts` is:

1. Read the text or OCR the screenshot into a faithful normalized question.
2. Name the tested skill and produce curriculum-language search terms.
3. Ask OpenAI web search for supporting evidence from official Texas domains only.
4. Rank records from `teks_standards` using skill overlap, subject, estimated grade, and exact codes mentioned by official-source research.
5. Give the top ten records to the selector. It may copy one candidate key exactly or return `unknown`; an invented key is rejected by application code.
6. Hydrate grade, subject, TEKS description, effective version, and source URL from the database record.
7. Run three constrained selections in parallel and vote on the validated subject/code pair.
8. Persist the retrieval plan, web citations, candidate scores, all samples, model IDs, and latency for audit.

The initial database corpus is curated around the highest-value math pathways and verified science expectations. It is deliberately honest about gaps: unsupported skills return `unknown` rather than falling back to an invented code. The next data task is bulk ingestion of the complete, versioned TEKS corpus; no classifier redesign is required.

### Could categorization be faster?

Yes, but do not replace a measured, working classifier hours before delivery merely because another model is branded “Flash.” The current wall time is already about seven seconds, and the three classification samples run concurrently.

The app now uses the strongest speed/quality hybrid:

1. Determine subject and extract the tested skill.
2. Use official-source web research to resolve wording/version ambiguity.
3. Retrieve a small set of candidate TEKS rows from Postgres.
4. Ask the model to select only from those candidates.
5. Validate that the selected key exists and derive grade/subject from its row.

That reduces hallucinated codes, shortens the prompt, and makes a faster model safer. If “JEB” refers to a particular provider, library, or educational standard, confirm the exact name before changing the pipeline; it is not a recognized substitute in the current codebase.

Gemini can be added through another Vercel AI SDK provider, and Gemini Flash supports image input and structured outputs. It is still a model change that needs the same labelled accuracy and determinism tests already run for GPT-4.1. Keep GPT-4.1 for tonight; benchmark Gemini after launch, especially on TEKS-code accuracy rather than raw latency alone.

## What Next.js is doing here

Next.js is both the React web framework and the application server.

- `src/app/page.tsx` is the `/` page.
- `src/app/lessons/page.tsx` is `/lessons`.
- `src/app/lessons/[id]/page.tsx` is the dynamic lesson route.
- `src/app/api/trpc/[trpc]/route.ts` is the HTTP endpoint. It exports the same tRPC handler for `GET` and `POST`.
- Files without `'use client'` are Server Components by default. They can call the database-side tRPC caller during server rendering without a browser HTTP round trip.
- `QuestionInput.tsx` has `'use client'` because it needs state, drag/drop, clipboard, canvas resizing, and browser navigation.

Express comparison: with Express you would manually create an app, attach middleware, declare routes, and separately configure React rendering/building. Next.js supplies the server, filesystem routing, React rendering, bundling, code splitting, and deployment conventions. The tRPC route handler is still ordinary HTTP underneath.

SEO needs a precise explanation. Next.js *can* render HTML on the server; it does not mean every page is always a static HTML file. The home page can be pre-rendered. Lesson and history pages are forced dynamic because they read Postgres on every request. Their initial HTML is server-rendered, which is more crawlable than a blank client-only shell, but SEO is not important for this demo and UUID lesson pages should probably be `noindex` in a real student-data product.

Important caveats:

- The two AI calls happen in one request, so function duration matters. The route sets `maxDuration = 120` seconds, but the effective limit depends on the Vercel plan.
- The UI polls during that same request; it is not a queue or resumable background job.
- There is no authentication or rate limiting, intentionally out of scope. A public deployment can spend AI credits.
- Screenshots are stored as base64 in Postgres. That is acceptable for a demo but should become object storage in production.
- The current Vercel AI SDK version marks `generateObject` deprecated in favor of `generateText` plus `Output.object`. The project keeps `generateObject` because the assignment explicitly requested it and it is still functional.

## What tRPC does

tRPC exposes server functions as a typed TypeScript API.

The root router has:

```text
health
lesson.generate
lesson.getById
lesson.list
```

`GenerateInputSchema` is Zod runtime validation at the HTTP boundary. It ensures there is exactly one of `text` and `imageDataUrl`, verifies that `inputType` agrees with the supplied value, limits text length, and restricts image data URLs and size.

In the browser, `api.lesson.generate.useMutation()` is type-checked against the server router. Rename an input or return field on the server and TypeScript shows the affected client code. `superjson` transports values such as `Date` more faithfully than plain JSON.

tRPC does not store data and it does not replace Zod. Its role is typed procedure routing and client/server inference.

## How Postgres is accessed

`src/server/db/index.ts` reads `DATABASE_URL`, creates a `pg.Pool` capped at five connections, and passes that pool to Drizzle.

Drizzle provides two useful layers:

- Schema declarations in `src/server/db/schema.ts` produce TypeScript types and describe the tables/relations.
- Query builders such as `ctx.db.insert(submissions).values(...).returning()` generate parameterized SQL and execute it through `pg`.

Drizzle does not eliminate SQL; it generates SQL safely from typed code. Raw SQL is still available, as shown by the health check's `select now()`.

The database location is entirely controlled by `DATABASE_URL`:

- Local development: Postgres is currently reachable on `localhost:5432`.
- Production: Neon runs Postgres as a managed service and gives Vercel the connection string.

Vercel does not run a durable Postgres process inside the Next.js deployment. Today, Vercel provisions or connects database providers through its Marketplace; Neon is its standard Postgres integration. The app runs on Vercel and opens network connections to Neon.

## Why three tables

```text
submissions 1 ---- many classifications
     |                    |
     +---- many lessons --+
```

- `submissions` preserves what the user sent before any AI call.
- `classifications` stores Call 1's business result plus model, latency, and raw audit data.
- `lessons` stores Call 2's validated object and links to the classification used to generate it.

There is deliberately no transaction wrapping all three inserts. If classification fails, the submission remains. If lesson generation fails, the submission and classification remain. That is partial persistence by design, not accidental inconsistency.

## Text input versus screenshot input

Text travels as a normal string. A screenshot is read in the browser as a base64 data URL. Images above 1.5 MB are resized to a maximum 1600-pixel dimension and converted to JPEG before upload. The server validates the media type and maximum encoded length, strips the data-URL wrapper, and sends an AI SDK file part to both model calls.

Sending the image to Call 2 matters: the classification schema does not contain a transcription field, so the lesson writer needs the original screenshot to see the exact question.

## Paper.design status

Paper is a design tool and MCP server, not a package the deployed website imports. “Using Paper” means opening Paper Desktop, creating a design file, connecting Codex through Paper's MCP panel, and using that design artifact to guide implementation.

Paper Desktop was later connected and the three screens were designed in the “Lesson Pipeline UI” Paper file. The approved input, generated-lesson, and history compositions were then implemented in Tailwind while preserving the existing tRPC and pipeline behavior. Paper remains a design artifact; production does not load a Paper runtime or package.

## Failure behavior

Each AI stage is wrapped independently. A failure becomes a typed tRPC `INTERNAL_SERVER_ERROR` with:

```ts
{
  stage: 'classify' | 'generate';
  submissionId: string;
}
```

The client uses that ID to show “The submission was saved” and link to the partial record. This is why persisting each stage before starting the next is valuable.

## The five answers to know cold

1. **Why two calls?** Focus, auditability, and explicit grade targeting. The first output becomes controlled input to the second.
2. **Why TEKS?** It replaces an ungrounded grade impression with a Texas-specific published reference and a specific code.
3. **Why structured output with Zod?** A model response is untrusted network data. The schema validates it at runtime and gives TypeScript the same shape.
4. **Why three tables?** The database mirrors the pipeline, preserves partial results, and separates classification problems from lesson-writing problems.
5. **Why tRPC plus Drizzle?** tRPC types the browser/server contract; Drizzle types the server/database contract. They solve different boundaries.

## Honest next steps

1. Import the complete official TEKS corpus (the retrieval architecture and an initial curated catalog are already live).
2. Build a labelled evaluation set and track grade accuracy, TEKS-code accuracy, schema failures, latency, and cost per model.
3. Add auth, rate limits, and abuse/cost controls before sharing broadly.
4. Store screenshots in Vercel Blob or S3 and keep only their URL in Postgres.
5. Split the long mutation into a resumable job or stream stage 2.
6. Add teacher override of the classification before lesson generation.
