# Lesson Pipeline — engineering report

Prepared October 11, 2026 (America/Chicago). This report describes the implemented
system, its evolution, the evidence collected, and the limits of that evidence.

- **Application:** https://lesson-pipeline.vercel.app
- **Source:** https://github.com/AdalHub/Lesson-pipeline
- **Examples:** https://lesson-pipeline.vercel.app/lessons
- **Automated checks:** https://github.com/AdalHub/Lesson-pipeline/actions
- **Acceptance evidence:** [READINESS.md](READINESS.md)
- **Code-level walkthrough:** [PROJECT_WALKTHROUGH.md](PROJECT_WALKTHROUGH.md)
- **Decision history:** [DECISIONS.md](DECISIONS.md)

## 1. What was built

A question-to-lesson application: paste a test question or upload/paste a screenshot,
then receive a lesson teaching the underlying method rather than only supplying an
answer. A classification stage identifies the subject, estimated grade alignment,
TEKS expectation, question type, difficulty and key concepts. A separate generation
stage receives that classification and writes the lesson at the selected level.

Three screens are implemented: question input, generated lesson and cursor-paginated
history. Lessons contain an objective, prerequisites, explanation, a new worked
example with explanations for each step, common mistakes, and new practice questions
with initially hidden hints/answers. Screens support desktop and mobile layouts.

The application is a working demonstration, not a student-information system or a
validated educational assessment. The production model calls are real. Fake providers
exist only in deterministic integration tests, never as a production fallback.

## 2. Project evolution

| Phase | Implementation and learning |
| --- | --- |
| Foundation | Next.js/TypeScript/Tailwind scaffold, Docker Postgres, Drizzle schema/migration, tRPC context and health check. |
| Initial pipeline | Two structured AI operations: classify against a prompt-level TEKS reference, then generate a lesson. Persist each completed stage. |
| Model experiments | Prototype smoke results reported instability and invented descriptions with a smaller model. GPT-4.1 plus a compact anchor and three parallel samples improved repeatability on that small sample. This was not an independent benchmark or a universal ranking of models. |
| Frontend and deployment | Text, screenshot upload/drop/paste, actual database-driven progress, lesson and history pages; deployed to Vercel with Neon Postgres and server-side credentials. |
| Paper integration | Initially unavailable, then connected through MCP. Input, lesson and history were designed in the `Lesson Pipeline UI` file and implemented in Tailwind. Paper is a design artifact, not a runtime dependency. |
| Grounded classification | Added a standards table, retrieval planning, official-domain web research, constrained candidate selection and source evidence. Replaced the old prompt-only TEKS lookup path. |
| Broader catalog | Imported 593 published ELAR/social-studies expectations from TEA PDFs, growing the table from 39 to 632 records. |
| Release hardening | Assertions, isolated database tests, live browser/API tests, confidence safeguards, upload limits, timeouts, source review and recoverable replacement of old demo records. |
| Repository handoff | Preserve the milestone commits, publish the existing source on GitHub under `main`, configure push/PR CI, and document setup and limitations. |

## 3. How TEKS classification improved

### TEKS is a reference system, not a list of broad subjects

Texas Essential Knowledge and Skills are published curriculum expectations organized
by subject and grade/course. “Math” is a subject; “2.4C” identifies a more specific
expectation within that subject. Codes can collide across subjects, so a bare code
is not a globally unique identity. High-school course alignment also does not imply
every student takes that course in the same numbered grade.

### Before: the model proposed a code, the database recorded it

The initial approach asked the model to classify using TEKS knowledge from training,
supplemented with a compact hand-written anchor in the prompt. Zod checked the output
shape. Postgres saved the resulting code and explanation.

That is useful prompt grounding, but it does not verify that a proposed code exists,
that its description is accurate, or that the question matches it. A string can pass
Zod while containing an invented standard. Three model samples may agree on the same
mistake. Temperature zero is not a correctness or absolute determinism guarantee.

### Now: the model chooses among retrieved database records

```text
Original question or screenshot
    ↓
Structured retrieval plan: full question, likely subject, skill, search terms
    ↓
Official-domain web lookup: supporting evidence, not an authoritative answer
    ↓
Retrieve up to 10 matching-subject records from the TEKS catalog
    ↓
Three parallel structured selections: a candidate key OR "unknown"
    ↓
Validate selection; copy grade/subject/code/description from the database row
    ↓
Vote, apply uncertainty safeguards, persist classification and evidence
    ↓
Separate lesson generation using that classification and original input
```

This is retrieval-augmented classification: authoritative context is retrieved before
the final model decision. There is no embedding service or separate vector database.
The model is not retrained and does not acquire permanent knowledge from these rows;
it receives relevant reference records at request time.

The implementation reads the small catalog from Postgres, filters by the planner's
subject, and ranks candidates in application code using token overlap, a grade hint
and explicit codes mentioned by web research. Code punctuation is normalized, so
`2.4C`, `2.4.C` and `2.4(C)` can refer to the same candidate. A Postgres full-text GIN
index exists, but the current ranking path does not use it. This distinction matters:
the implementation should not be presented as vector search or indexed full-text RAG.

The selection schema builds a dynamic enum from the retrieved keys plus `unknown`.
The server then validates the key again and hydrates the output from its database
record. For a known selection, grade/subject/description no longer depend on the
model recalling them correctly. On unknown selection, the grade remains a low-confidence
planner estimate and the UI says no verified TEKS record was selected.

**The guarantee is narrow:** a selected known code is one of the retrieved catalog
records and its copied metadata matches that record. It does **not** guarantee the
catalog is complete or error-free, that retrieval found the best candidate, or that
the model chose the correct semantic match. Structured outputs can still contain
substantive mistakes; schema adherence is not factual correctness. See the
[OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

### Web lookup helps, but is not trusted blindly

The app uses OpenAI's provider-hosted `web_search`, restricted to official TEA/TAC
domains. It stores the memo and source URLs, and displays evidence links on the lesson
page. Search failures/timeouts do not disable local catalog retrieval.

Testing showed why citations alone are insufficient: one memo incorrectly favored
an adult-assisted grade-1 inference standard. The model still needed to compare the
actual question against the retrieved expectations. Web prose was removed from lexical
ranking, while exact code mentions remain supporting ranking signals. The selector
is explicitly told that web conclusions can be wrong and must not overrule the input
or candidate expectations. External text is treated as data, not instructions.

### Concrete bugs caught and corrected

1. **Multiple-choice cognitive demand:** an item contrasting physical and chemical
   changes initially mapped to the narrower fact “ice melts.” Prompts now consider
   the distinction required to reject the distractors, producing the intended
   grade-7 `7.6C` alignment in the final regression case.
2. **Scaffolding versus independent work:** an inference question was treated as
   adult-assisted even though the input did not specify help. The selector now assumes
   independent assessment unless assistance is explicit, and the planner must retain
   the full passage/options. The final example selected grade-3 `3.6F`.
3. **Repeated skills across grades:** nearly identical inference expectations exist
   in several grades. Application code now compares normalized candidate expectations
   across grades and forces low confidence for detected duplicates. This is a targeted
   heuristic, not a comprehensive ambiguity detector or calibrated probability.
4. **Task versus supporting procedure:** a word problem selected the general addition
   algorithm standard. The selector now prefers the expectation describing the assessed
   task over a supporting procedure; the final example selected `2.4C`.
5. **Code formats and collisions:** punctuation normalization improves code matching;
   subject filtering prevents a code from another subject receiving the wrong match.

The planner's subject can itself be wrong, and filtering by it can exclude the right
standard. That is a remaining retrieval limitation, not something voting solves.

## 4. Catalog ingestion and provenance

| Subject | Records | Scope |
| --- | ---: | --- |
| Math | 33 | Curated elementary-through-high-school subset |
| Science | 6 | Curated subset, including explicit physical/chemical distinction |
| Reading / language arts | 303 | Lettered expectations, grades 1–5, adopted 2017 |
| Social studies | 290 | Lettered expectations, grades 1–5, adopted 2022 |
| **Total** | **632** | **Partial catalog, not complete K–12 coverage** |

`scripts/extract-teks.py` uses Python/pypdf to extract the two TEA chapter PDFs, remove
page furniture/introduction sections, preserve roman-numeral subparts inside their
lettered parents, and emit reviewable JSON. The snapshot includes source URLs and
SHA-256 document hashes. The descriptions for the expansion preserve expectation
text rather than generating new “official” descriptions with an LLM.

`scripts/import-teks.ts` validates the snapshot with Zod, checks key uniqueness and
source counts, and imports it through Drizzle inside one transaction. The unique
subject/code/version key makes repeated imports idempotent. Existing records are not
silently overwritten. The import was tested locally before being applied to Neon.

Sources and exact exclusions are documented in [data/README.md](data/README.md), with
links to the [TEA ELAR rules](https://tea.texas.gov/laws-and-rules/texas-administrative-code/19-tac-chapter-110)
and [TEA social-studies rules](https://tea.texas.gov/laws-and-rules/texas-administrative-code/19-tac-chapter-113).
Kindergarten, secondary ELAR/social studies, and standalone non-lettered expectations
were not imported. The original 39 curated records have a different ingestion history
from the 593 extracted additions; do not describe every record as an automated PDF import.

## 5. Technologies and their actual roles

| Technology | Role in this project |
| --- | --- |
| Next.js 15 App Router | File-based pages, React server rendering, and the HTTP route serving tRPC. A separate Express server is unnecessary. |
| React 19 + TypeScript | Interactive input/progress controls and typed components. TypeScript protects development-time contracts, not untrusted runtime input. |
| Tailwind CSS 4 + typography plugin | Responsive layout, shared design tokens and Markdown typography matching the Paper design. |
| Paper.design MCP | Design and inspect the three frontend compositions; no Paper runtime is shipped to browsers. |
| tRPC 11 | Typed server procedures (`generate`, `getById`, `list`) and client calls; errors carry pipeline stage/submission identity. It is not a substitute for runtime validation. |
| TanStack Query | Client-side mutation/query state and progress polling through the tRPC React integration. |
| SuperJSON | Serializes values such as dates across the HTTP boundary while preserving their types. |
| Zod 4 | Runtime schemas for inputs, retrieval plans, model selections and lesson output; enum/range/cardinality constraints. |
| Vercel AI SDK | `generateObject` for structured output; `generateText` for provider-hosted web research; provider response/usage metadata. |
| OpenAI / GPT-4.1 | Image/text understanding, retrieval planning, constrained classification and grade-targeted lesson generation. Model IDs are configurable independently by stage. |
| PostgreSQL on Neon | Persistent submissions, classifications, lessons and standards. Neon hosts the database; Vercel hosts the application. |
| Drizzle ORM + drizzle-kit | Typed table definitions and queries, relations, and versioned SQL migrations. It produces/executes SQL rather than eliminating SQL or database design. |
| node-postgres (`pg`) | Actual Postgres driver and reusable connection pool. Runtime uses a pooled Neon URL; migrations prefer the direct endpoint. |
| react-markdown + remark-gfm | Render explanations as Markdown; hints/answers use native HTML `details` elements. |
| Node test runner + tsx | Repeatable TypeScript unit/integration tests without adding a large test framework. |
| Playwright Core + Chrome | Real browser smoke tests, generated worksheet PNG upload, clipboard-event preview, navigation and mobile overflow checks. |
| Docker Postgres | Separate local test database; regular integration tests never need production credentials. |
| Git/GitHub Actions | Milestone history, source publication, push/PR checks with an isolated Postgres service. |
| Vercel | Next.js production builds, server-side environment variables and the public app URL. |

The home page is prerendered, while lesson/history pages are dynamic server-rendered
pages because they read the database. Next.js does not mean all HTML is permanently
prerendered. Server rendering can expose meaningful HTML to crawlers, but it neither
guarantees search indexing nor provides access control.

## 6. Data flow and schemas

The browser supplies exactly one input: trimmed text (1–10,000 characters) or a
supported image data URL. Larger images are resized client-side; encoded image length
is capped at 4 million characters to leave room below Vercel's request-body limit.

`QuestionInput.tsx` creates a UUID and calls `api.lesson.generate`. HTTP reaches the
Next.js `/api/trpc/[trpc]` route, then the tRPC router. Zod validates before a submission
is inserted. The browser polls the UUID while generation runs; a saved classification
indicates that the lesson stage has begun. This is real persistence-driven progress,
not a simulated timer.

The key structured contracts, abbreviated from the actual schemas:

```ts
type RetrievalPlan = {
  reasoning: string;
  normalizedQuestion: string;
  subject: 'math' | 'reading_language_arts' | 'science' | 'social_studies' | 'other';
  estimatedGrade: number; // integer 1–12; retrieval hint only
  skill: string;
  searchTerms: string[]; // 3–10
};

type CandidateSelection = {
  reasoning: string; // concise visible rationale, not hidden model reasoning
  selectedCandidateKey: string; // runtime enum: retrieved keys or 'unknown'
  gradeLevelConfidence: 'high' | 'medium' | 'low';
  questionType: 'multiple_choice' | 'short_answer' | 'word_problem' |
    'computation' | 'essay' | 'other';
  difficulty: 'below_grade' | 'on_grade' | 'above_grade';
  keyConcepts: string[]; // 1–5
};

type Classification = {
  reasoning: string;
  gradeLevel: number; // 1–12; database-derived for a known selection
  gradeLevelConfidence: 'high' | 'medium' | 'low';
  subject: RetrievalPlan['subject'];
  teksStandard: string;
  teksDescription: string;
  questionType: CandidateSelection['questionType'];
  difficulty: CandidateSelection['difficulty'];
  keyConcepts: string[];
};

type Lesson = {
  title: string;
  objective: string;
  prerequisites: string[];
  explanation: string; // Markdown
  workedExample: {
    problem: string;
    steps: { step: string; explanation: string }[]; // at least 2
    answer: string;
  };
  commonMistakes: { mistake: string; whyItHappens: string; howToAvoid: string }[]; // 1–4
  practiceProblems: { problem: string; hint: string; answer: string }[]; // 2–5
};
```

`reasoning` comes first as a prompt/output organization choice. It is an inspectable
rationale, not proof of the model's true internal reasoning or a guaranteed accuracy boost.

Four tables serve distinct purposes:

| Table | Stored information |
| --- | --- |
| `submissions` | UUID, input type, text or image data URL, creation time |
| `classifications` | Submission FK, validated labels, rationale, concepts, model, latency and raw retrieval/search/vote evidence |
| `lessons` | Submission/classification FKs, title, structured lesson JSON, model and latency |
| `teks_standards` | Code, subject, grade/course, knowledge-and-skills statement, expectation, description, version, source URL/kind and search text |

The three pipeline tables are intentionally not wrapped in one all-or-nothing
transaction: classification failure leaves the original input; generation failure
leaves both input and classification. The catalog import, by contrast, is atomic.
History pagination uses `(createdAt, id)` so timestamp ties do not duplicate/skip rows.

## 7. Request count, latency and cost tradeoffs

There are **two business stages**, but the upgraded implementation is not literally
two model requests. With defaults and no retries, it performs one planning request,
one web-research request, three parallel candidate selections, and one lesson request:
six application-level model operations. The hosted search tool may perform its own work.

Three samples reuse the same candidate context, so their errors are correlated.
Voting can improve consistency but adds cost without independent evidence. Sample
count is clamped to 1–5. Ties or partial sample failure lower confidence.

Planner/search/selection/generation have respective 20/30/20/40-second deadlines.
Search is optional and can fall back to local retrieval; total requests can still fail.
The route declares a 120-second maximum, and completed stages remain inspectable.

The final non-math live smoke cases took roughly 12.8–14.7 seconds. The original
prompt-only prototype was faster (roughly seven seconds in earlier notes). This is
a measured small sample, not a latency SLA. No reliable per-request dollar-cost
benchmark was produced. Usage metadata is recorded, but there is no cost dashboard.

GPT-4.1 was retained based on the prototype results instead of switching providers
near handoff. Gemini was considered but not integrated or benchmarked. The AI SDK
provides an abstraction, but provider-hosted web search is OpenAI-specific, so a
provider swap is not just changing a model string. `generateObject` remains in use
despite its installed SDK's deprecation notice; migration should be tested separately.

## 8. Testing and evidence

| Layer | Evidence | What it does not prove |
| --- | --- | --- |
| Offline unit tests | 15 passing: valid/invalid inputs, schemas, code formatting, subject filtering, hydration/unknown, voting/sample bounds, ambiguity and catalog checks | Real provider reliability or semantic accuracy |
| Postgres integration | 8 passing: text/image success, exact classification handoff, both failure stages, invalid input/output, NOT_FOUND and pagination ties | Live vision quality; fake AI outputs are deliberately used here |
| Live HTTP/provider tests | Science, reading and social studies passed, including real citations and persisted rows | Broad curricular accuracy or calibrated confidence |
| Live browser tests | Grade-2 text, grade-6 screenshot, Geometry text; progress, history, answer reveal, screenshot display, synthetic clipboard preview, mobile overflow | All browsers/devices or native OS clipboard behavior |
| Post-cleanup checks | Six history entries; all lesson/source panels load; removed old URL returns 404 | Multi-user isolation or load resilience |
| Build/tooling | Lint, typecheck and production build passed locally; Vercel build passed | Security/compliance certification |
| GitHub CI | Workflow runs unit/integration tests, lint, typecheck and build using disposable Postgres; publication-run status is recorded in the handoff | Paid live-provider smoke tests are intentionally not run on every PR |

Live tests found actual errors and led to fixes. The final six examples are therefore
regression cases, not a blind holdout set. Claims like “100% accurate” or “TEKS guarantees
the grade” would not be justified. A larger independent, teacher-labelled evaluation
set is the most valuable next quality step.

## 9. Operational cleanup and publication safety

Eight old examples and seven intermediate test examples were archived locally, then
deleted by exact snapshot IDs. Foreign-key cascades removed their outputs. Six final
examples remain. Backups support restoration and are excluded from Git and Vercel.

The source publication check examines Git history and tracked content for known local
secret values, common credential patterns, sensitive paths and copied correspondence.
It is a focused check, not a comprehensive security audit. Environment files, backups,
private correspondence and scratch PDFs are excluded. A real author email remains
in the existing Git commit metadata; preserving history does not anonymize its authors.

CI uses an explicit read-only repository permission and a local test database. It
requires neither the production OpenAI key nor Neon credentials. Never put those
credentials into ordinary workflow YAML or share them with forked PR jobs.

## 10. Honest limits and next steps

The requested framework, design, input/output, persistence and two-stage workflow are
implemented. Additional grounding, provenance and validation make the decisions more
auditable and prevent some failure classes. They do not eliminate model mistakes.

Before broader public/student use:

1. Add authentication, per-user authorization/history isolation, rate limiting and
   usage/budget controls. The current UI warns that history is public/shared.
2. Expand and version-review the catalog, especially science and secondary subjects;
   validate extraction coverage and course/grade conventions with educators.
3. Build a holdout evaluation set measuring candidate recall, code/grade alignment,
   abstention, correctness of lesson examples, latency and cost separately.
4. Consider single-selection versus voting and conditional web lookup using measured
   tradeoffs rather than assuming more model calls are always better.
5. Move screenshot storage to a blob store, add streaming/background jobs as needed,
   and improve observability and retry/idempotency semantics.
6. Add accessibility and cross-browser testing beyond the current smoke checks.

The strongest explanation of this project is not “the model always gets it right.”
It is: **the model interprets the question; published records constrain the answer;
application code validates the boundary; tests and saved evidence expose failures.**
