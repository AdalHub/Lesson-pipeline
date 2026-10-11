# Lesson Generation Pipeline — Build Spec

**Drop this at the repo root as `SPEC.md` (or `CLAUDE.md`) and point your coding agent at it.**

---

## 0. HOW YOU (THE AGENT) SHOULD WORK

Read this section first and follow it literally.

1. **You own correctness.** Write the code, run it, test it, fix it. Do not hand work back to me until the pipeline runs end to end and you have verified it yourself with real output.
2. **Do not ask permission for routine decisions.** Pick sensible defaults, note them in a `DECISIONS.md`, and keep moving. Only stop for things you genuinely cannot resolve — a missing API key, a paid service, an ambiguous product requirement.
3. **Test as you go.** After each milestone, prove it works: run the dev server, hit the endpoint, query the DB, print the output. Paste evidence, not assurances.
4. **Never commit secrets.** All keys in `.env.local`. Verify `.env*` is in `.gitignore` before the first commit.
5. **Typecheck must pass** (`npx tsc --noEmit`) before you call any milestone done.
6. **Commit after each milestone** with a clear message.

When you are finished, report: what's built, what you verified and how, what you'd do next, and anything you faked or stubbed.

---

## 1. WHAT WE'RE BUILDING

A web app where a user pastes a test question (text or screenshot) and gets back a generated lesson that teaches a student how to answer that type of question.

The pipeline is **two separate AI calls**, deliberately:

```
Input (pasted text OR screenshot image)
        │
        ▼
CALL 1 — CLASSIFY  ·  anchored to TEKS
   → grade level, subject, TEKS standard, question type,
     difficulty, key concepts
        │
        ▼
CALL 2 — GENERATE  ·  receives the classification as input
   → lesson: objective, explanation, worked example,
     common mistakes, practice problems
        │
        ▼
Persist both to Postgres  →  Render the lesson
```

**Why two calls, not one:** a single call asked to classify *and* generate does both worse. Separating them keeps each prompt focused, makes the classification auditable on its own, and lets the generation prompt be explicitly targeted at a known grade level.

**Why TEKS:** "what grade level is this?" with no reference point produces inconsistent answers between runs. Texas Essential Knowledge and Skills is a published standard the model knows from training, so it anchors the judgment to a fixed external scale. (This is a Texas school — TEKS over Common Core is deliberate.)

---

## 2. STACK — use exactly these

| Layer | Choice |
|---|---|
| Framework | **Next.js 15**, App Router, TypeScript, `src/` dir |
| Styling | **Tailwind CSS** |
| Database | **Postgres** — Neon free tier (serverless, Vercel-native) |
| ORM | **Drizzle ORM** + `drizzle-kit` |
| API layer | **tRPC v11** with the Next.js App Router adapter |
| Validation | **zod** — one schema per AI call, shared between the model and the DB layer |
| AI | **Vercel AI SDK** (`ai` package), using **`generateObject`** |
| Deploy | **Vercel** |
| Design | **Paper.design** via its MCP (see §8) |

**On `generateObject` specifically:** it takes a zod schema directly and returns typed, validated output. That is exactly the "structured output endpoint + rigid typing with zod" requirement, and it keeps the provider swappable. Do not hand-roll JSON parsing with retries.

---

## 3. DATABASE SCHEMA

Three tables. The split mirrors the two-call pipeline — one row per stage, so a bad classification is diagnosable separately from a bad lesson.

```ts
// src/server/db/schema.ts

submissions
  id            uuid pk default random
  inputType     enum('text','image')
  rawText       text nullable
  imageUrl      text nullable
  createdAt     timestamp default now

classifications
  id                   uuid pk
  submissionId         uuid fk → submissions.id, cascade
  gradeLevel           integer
  gradeLevelConfidence enum('high','medium','low')
  subject              text
  teksStandard         text         // e.g. "5.3K"
  teksDescription      text
  questionType         text
  difficulty           enum('below_grade','on_grade','above_grade')
  keyConcepts          jsonb        // string[]
  reasoning            text
  model                text
  latencyMs            integer
  rawResponse          jsonb
  createdAt            timestamp default now

lessons
  id               uuid pk
  submissionId     uuid fk → submissions.id, cascade
  classificationId uuid fk → classifications.id, cascade
  title            text
  content          jsonb            // full LessonSchema object
  model            text
  latencyMs        integer
  createdAt        timestamp default now
```

Store `rawResponse`, `model` and `latencyMs` on both — you cannot debug a pipeline you didn't instrument.

---

## 4. ZOD SCHEMAS

```ts
// src/server/ai/schemas.ts
import { z } from 'zod';

export const ClassificationSchema = z.object({
  reasoning: z.string()
    .describe('Briefly, how you determined grade and subject. Write this FIRST.'),
  gradeLevel: z.number().int().min(1).max(12),
  gradeLevelConfidence: z.enum(['high', 'medium', 'low']),
  subject: z.enum([
    'math', 'reading_language_arts', 'science', 'social_studies', 'other',
  ]),
  teksStandard: z.string()
    .describe('TEKS identifier, e.g. "5.3K". Use "unknown" if you cannot map it.'),
  teksDescription: z.string()
    .describe('Plain-language description of what that TEKS standard covers.'),
  questionType: z.enum([
    'multiple_choice', 'short_answer', 'word_problem',
    'computation', 'essay', 'other',
  ]),
  difficulty: z.enum(['below_grade', 'on_grade', 'above_grade']),
  keyConcepts: z.array(z.string()).min(1).max(5),
});

export const LessonSchema = z.object({
  title: z.string(),
  objective: z.string().describe('One sentence: what the student will be able to do.'),
  prerequisites: z.array(z.string()),
  explanation: z.string()
    .describe('Markdown. Teach the concept at the given grade level.'),
  workedExample: z.object({
    problem: z.string(),
    steps: z.array(z.object({
      step: z.string(),
      explanation: z.string().describe('WHY this step, not just what.'),
    })).min(2),
    answer: z.string(),
  }),
  commonMistakes: z.array(z.object({
    mistake: z.string(),
    whyItHappens: z.string(),
    howToAvoid: z.string(),
  })).min(1).max(4),
  practiceProblems: z.array(z.object({
    problem: z.string(),
    hint: z.string(),
    answer: z.string(),
  })).min(2).max(5),
});

export type Classification = z.infer<typeof ClassificationSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
```

**`reasoning` is first on purpose** — the model fills fields in order, so making it reason before committing to a grade produces better classifications and gives us something to read when it's wrong.

---

## 5. THE TWO CALLS

```ts
// src/server/ai/classify.ts

const CLASSIFY_SYSTEM = `
You classify K-12 test questions against the Texas Essential Knowledge
and Skills (TEKS) standards.

Given a question, identify the grade level, subject, and the specific TEKS
standard it assesses. Anchor every judgment to TEKS — do not guess a grade
level from general impression. Ask yourself which TEKS standard this
question is testing, then report the grade that standard belongs to.

If you cannot confidently map it to a TEKS standard, set teksStandard to
"unknown", give your best grade estimate, and set gradeLevelConfidence to "low".
Never invent a TEKS code.
`;

// generateObject({ model, schema: ClassificationSchema,
//   system: CLASSIFY_SYSTEM, messages: [...] })
// Image input: attach as an image part in the message content.
```

```ts
// src/server/ai/generate.ts

const GENERATE_SYSTEM = `
You write short, focused lessons that teach a student how to solve a
specific type of test question.

You will be given a question and its classification (grade level, subject,
TEKS standard, key concepts). Write the lesson FOR THAT GRADE LEVEL —
vocabulary, sentence length, and examples must suit that age.

Teach the underlying method so the student can solve similar problems,
not just this one. Do not simply give the answer.
`;

// The user message passes the classification explicitly:
//   Question: <raw>
//   Grade level: <n>
//   Subject: <s>
//   TEKS: <code> — <description>
//   Key concepts: <list>
```

Call 2 **must** receive call 1's output as explicit input. That's the whole point of the split.

---

## 6. tRPC ROUTER

```ts
// src/server/api/routers/lesson.ts

lesson.generate   mutation
  input:  z.object({
            inputType: z.enum(['text','image']),
            text: z.string().optional(),
            imageDataUrl: z.string().optional(),
          }).refine(exactly one of text/imageDataUrl is present)
  does:   insert submission
        → classify (time it)
        → insert classification
        → generate (time it, passing classification)
        → insert lesson
        → return { submissionId, classification, lesson }

lesson.getById    query   input { id: z.string().uuid() }
lesson.list       query   input { limit, cursor } — newest first
```

Wrap the two AI calls in try/catch. On failure, persist what succeeded and return a typed error — a failed generation should not lose the classification.

---

## 7. FILE STRUCTURE

```
src/
  app/
    layout.tsx
    page.tsx                    # upload / paste form
    lessons/[id]/page.tsx       # rendered lesson
    lessons/page.tsx            # history list
    api/trpc/[trpc]/route.ts
  components/
    QuestionInput.tsx           # textarea + file drop + paste-image handler
    LessonView.tsx
    ClassificationBadge.tsx     # grade · subject · TEKS · confidence
  server/
    db/
      index.ts
      schema.ts
    ai/
      schemas.ts
      classify.ts
      generate.ts
    api/
      trpc.ts
      root.ts
      routers/lesson.ts
  trpc/
    client.tsx
    server.ts
drizzle/                        # migrations
.env.local                      # never committed
SPEC.md
DECISIONS.md
```

---

## 8. FRONTEND

Three screens, kept deliberately small:

1. **Input** — textarea for pasted text, drag-drop + file picker for screenshots, and handle `onPaste` of image data from the clipboard (that's how people actually paste screenshots). Loading state while both calls run — show which stage is running, since it takes several seconds.
2. **Lesson view** — classification badges at the top (grade, subject, TEKS code, confidence), then objective, explanation (render the markdown), worked example with steps, common mistakes, practice problems with hidden answers.
3. **History** — list of past submissions, click through to the lesson.

**Paper.design:** install it and use its MCP to design these screens, per the spec. Follow their current setup docs for MCP configuration. If you hit a blocker, build clean Tailwind screens instead and note it in `DECISIONS.md` — a working app beats a blocked one — but try Paper first.

---

## 9. ENV

```
DATABASE_URL=            # Neon connection string
OPENAI_API_KEY=          # or ANTHROPIC_API_KEY — whichever provider
```

Confirm `.gitignore` covers `.env*` **before** the first commit.

---

## 10. BUILD ORDER

Commit at each step.

1. `create-next-app` — TS, Tailwind, App Router, src dir. Verify it runs.
2. Neon database, `DATABASE_URL` set, Drizzle installed, schema written, migration pushed. **Verify: connect and list the three tables.**
3. tRPC wired, with a `health` query. **Verify: hit it from the browser.**
4. zod schemas + `classify.ts`. **Verify: a script that classifies three real questions of different grades and prints the output.**
5. `generate.ts`. **Verify: feed it a classification, print a full lesson.**
6. `lesson.generate` wired end to end with persistence. **Verify: run it, then query the DB and show all three rows.**
7. Frontend — input, lesson view, history.
8. Image input path. **Verify with a real screenshot.**
9. Deploy to Vercel. **Verify the live URL works.**

---

## 11. ACCEPTANCE CRITERIA

Do not report finished until every line is true and you have checked it:

- [ ] `npx tsc --noEmit` passes clean
- [ ] `npm run build` succeeds
- [ ] Pasting a text question produces a classification and a lesson
- [ ] Uploading a screenshot produces a classification and a lesson
- [ ] A 3rd-grade question classifies as grade 3-ish; an 8th-grade question as 8-ish. **Test at least three grade levels and report what you got.**
- [ ] The same question classified twice gives the same grade
- [ ] All three table rows are written, with `model` and `latencyMs` populated
- [ ] The lesson's reading level visibly differs between a grade 2 and a grade 10 question — **paste both outputs as evidence**
- [ ] History page lists past submissions; clicking one loads it
- [ ] An AI failure returns a clean error without losing the submission row
- [ ] No secrets in git history
- [ ] Deployed and working on Vercel

---

## 12. OUT OF SCOPE

No auth, no users, no payments, no multi-tenancy, no caching layer, no rate limiting, no streaming. This is a pipeline demo. Don't gold-plate it.

---

## 13. WHEN DONE

Write a short `README.md` with:
- What it does, in three sentences
- The two-call architecture and why it's split
- Why TEKS
- How to run it locally
- Live URL
- What you'd do next with more time
