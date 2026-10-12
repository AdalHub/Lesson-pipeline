# Staff-engineer handoff

Verified October 11, 2026 (America/Chicago; October 12 UTC).

Live app: https://lesson-pipeline.vercel.app

Application deployment used for the live test evidence below: `lesson-pipeline-fx93v9pvu-adals-projects-42d1862b.vercel.app`.
The public alias is the link to share; generated deployment URLs may require Vercel login.

## Palmer's actual email requirements

| Request | Evidence / status |
| --- | --- |
| Paste a question or upload a screenshot | Live Chrome tests passed text, file upload and synthetic clipboard-image preview. |
| Structured AI output, classifiers and Zod | Retrieval plan, constrained candidate selection and lesson schemas; runtime validation in the router; unit tests reject malformed data. |
| Next.js | App Router pages and `/api/trpc/[trpc]` route; production build passed locally and on Vercel. |
| Paper.design via MCP | Connected `Lesson Pipeline UI` file contains Input, Generated Lesson and History artboards; Tailwind implementation shipped earlier and retained. Confirmed via Paper MCP this audit. |
| Postgres + Drizzle + tRPC | Neon pooled Postgres, versioned Drizzle migrations, typed tRPC procedures; six complete persisted input/output triplets verified directly. |
| Model tests and validates before handoff | 15 offline tests, 8 isolated real-Postgres integration tests, six final live pipeline cases, browser interactions/mobile checks, lint, typecheck and build all passed. |
| TEKS/Common Core anchor **or** lookup tool | Both implemented: 632 versioned catalog records plus provider web search restricted to official TEA/TAC domains. Palmer explicitly preferred the anchor; both were not required. |
| Classify first, then generate using that result | Router persists classification, then passes it explicitly into lesson generation; integration tests assert the exact handoff. |

**Assessment:** the requested functional and technology scope is met. Retrieval,
provenance, recoverable cleanup and repeatable tests go beyond the minimum exercise.
This is ready to demonstrate, not evidence of complete educational accuracy or
production-scale readiness. No software submission guarantees a hiring decision.

## Verified fresh demos

| Input / skill | Grade alignment | TEKS | Saved lesson |
| --- | --- | --- | --- |
| Text: two-digit addition word problem | 2 | 2.4C | [Open](https://lesson-pipeline.vercel.app/lessons/5db9c765-b2e8-41f4-bae2-848bcd060ecc) |
| Screenshot: order of operations, no grade label in image | 6 | 6.7A | [Open](https://lesson-pipeline.vercel.app/lessons/db9bb6c9-3228-41fe-aa6c-73fca5bc2206) |
| Text: physical versus chemical change | 7 | 7.6C | [Open](https://lesson-pipeline.vercel.app/lessons/9e48e004-c9b7-42b8-938d-0ee1e48b2ca9) |
| Text: equation of a circle | 10 (Geometry convention, not mandatory placement) | G.12E | [Open](https://lesson-pipeline.vercel.app/lessons/6f513292-725b-406f-aaec-e5a8c7d3e4e6) |
| Text: inference with evidence | 3, **low confidence** because expectation repeats across grades | 3.6F | [Open](https://lesson-pipeline.vercel.app/lessons/b40bd50d-c3be-4793-be55-2dcd75f0f8c3) |
| Text: purposes of the Constitution's Preamble | 5 | 5.14B | [Open](https://lesson-pipeline.vercel.app/lessons/4964df26-c39a-48f6-ac56-8a8a060212d9) |

Final non-math HTTP checks took approximately 12.8–14.7 seconds each and returned
official citations. This is a small smoke sample, not a latency SLA or statistically
meaningful accuracy benchmark. The full pipeline no longer averages the old
prototype's claimed seven seconds because classification includes retrieval/web work.

The six submissions each have one classification and one lesson, all with valid
schemas, matching catalog grade/subject/code, model names and latency values.
Browser checks covered stage changes, history click-through, answer reveal, screenshot
rendering, clipboard preview, and no horizontal overflow at 390px on all three screens.
Clipboard testing uses a synthetic event, not an OS clipboard end-to-end test.

## Tests and automation

- `npm test`: 15 deterministic tests, no AI key/network/database required.
- `npm run test:integration`: 8 tests against isolated local `lesson_pipeline_test`;
  real SQL/Drizzle/tRPC, injected AI results. Both failure stages preserve prior rows.
- `npm run smoke:ui`: real Chrome + deployed provider calls when `BASE_URL` is set;
  writes three example lessons and screenshots under ignored `screenshots/`.
- `npm run smoke:live`: three real HTTP/provider cases across the other subjects;
  asserts schema, classification, citations and persisted output. Writes three lessons.
- `scripts/verify-live-db.ts`: read-only final demo/corpus consistency checks.
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- `.github/workflows/ci.yml`: push/PR execution with disposable Postgres. The first
  [hosted run passed](https://github.com/AdalHub/Lesson-pipeline/actions/runs/38203785177)
  unit/integration tests, lint, typecheck and build for commit `07dbc9a`.
  Production credentials and paid live-provider checks are not part of ordinary CI.

Live tests caught two classification problems before handoff: an inference question
was classified as adult-assisted grade 1, and an addition word problem chose the
general algorithm standard. The selector now distinguishes independent work from
scaffolding and prefers task-specific expectations. A deterministic rule lowers
confidence for repeated expectations. Final reruns passed; future inputs may still
be misclassified. The prompt changes were informed by these tests, so the examples
are regression cases, **not an independent holdout evaluation set**.

## Catalog coverage and cleanup

632 records: 33 math, 6 science, 303 reading/language arts, 290 social studies.
The 593 additions were extracted from published TEA PDFs, not synthesized by AI.
`data/README.md` documents scope, source URLs, source SHA-256 hashes and reproducible
extraction/import commands. Import passed locally before being applied to Neon.

Removed eight pre-upgrade demos plus seven intermediate test demos, cascading their
classification/lesson rows. Six final demos remain. All removed rows are recoverable
from three local, gitignored backups:

- `backups/demos-1791777605997.json` (8 original submissions)
- `backups/demos-1791778163043.json` (4 intermediate submissions)
- `backups/demos-1791778262991.json` (3 intermediate submissions)

Use `node --env-file=.env.local --import tsx scripts/manage-demos.ts restore <path>`
to restore a backup. Backups are local only and excluded from Vercel deployment.

## Remaining limitations worth saying out loud

1. **Partial TEKS catalog.** ELAR/social studies cover lettered expectations in grades
   1–5, not K–12. Math/science remain curated subsets. Unknown is supported when no
   candidate fits, but correct code existence cannot guarantee correct semantic alignment.
2. **Public shared demo.** No authentication, private histories or app rate limiting.
   Input UI warns not to upload personal/student data. Add these protections and provider
   budget controls before broader public/student use. Secrets remain server-side.
3. **Small evaluation set.** More teacher-labelled, independent questions are the next
   quality investment. Voting improves some consistency, not guaranteed truth. Confidence
   is heuristic; a grade label is not a student-placement assessment.
4. **Live quality tests are separate from CI.** GitHub checks the deterministic contracts
   and real local SQL integration, not model quality. Re-run paid provider/browser smoke
   tests intentionally when changing prompts, models or retrieval.
5. **Operational simplicity.** Base64 screenshots in Postgres, synchronous generation,
   lexical in-memory retrieval, and no full tracing/cost dashboard. These are reasonable
   exercise tradeoffs, not a design for a large school deployment.

For the conversation with Palmer, be ready to explain the stage boundary, runtime
Zod validation versus tRPC's compile-time types, partial persistence, authoritative
code selection versus uncertain grade inference, and what the tests do **not** prove.

## Source handoff

Published to [AdalHub/Lesson-pipeline](https://github.com/AdalHub/Lesson-pipeline) on
`main`, retaining all 15 original milestone commits. Vercel is connected to the GitHub
repository. Publication checks found no known local credential values, common secret
patterns or copied email correspondence in the checked tracked content/history.
This focused check is not a comprehensive security audit. The private email draft and
database backups remain local and ignored; existing Git author metadata is public.
