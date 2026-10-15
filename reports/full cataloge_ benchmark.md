# Full catalogue benchmark

Prepared October 15, 2026. Experiments run October 14. **Offline classification experiments; not a production deployment.** No lesson-generation or UI changes are included in this report's publication.

## The three strategies we tested

All three start with the same **4,888-record TEKS catalog** and use JEV `jev-1.13.0` for their final choice. They differ in how they find candidates. None receives the question's official subject or grade in the original A/B/C experiment.

### A: all-catalog batches

A is a tournament: **batch → keep candidates → reduce again → final choice**.

Every standard enters an initial batch. Each batch gets one JEV Choice, and the application retains its top three standard candidates. Survivors are re-batched and reduced until one joint final Choice fits. Keeping three is a survivor quota, not three total batches. Unknown is available in the judgments; intermediate screening still retains standard alternatives.

**The recorded runs used 88–90 initial batches**, depending on question size and seeded packing order. The earlier “89” was the preflight estimate from unshuffled input, not an exact count for every shuffled run. Roughly 55 expectations fit in each initial batch. There are two implementation guards: **28,000 UTF-8 request bytes and 210 standard options per batch**, plus unknown. The provider permits 255 total Choice options, but paragraph-length descriptions generally hit our conservative byte guard first. The byte guard is our implementation choice, not the provider's maximum request size. [TypeSafe API reference](https://docs.typesafe.ai/api)

About 267 initial survivors therefore need another reduction round; the final sets contain 15–18 standards. Across this run, A made **94–97 API calls per question**, averaging 94.6. That accounts for approximately **$0.0271 per question** and **5.30 seconds median** whole-strategy time.

Trade-off: broad consideration, more cost and calls, and possible screening or final-choice errors. Every record being examined does not guarantee the official answer survives. It did survive in all 36 trials in this particular run.

### B: subject and grade/course hierarchy

B is a narrowing funnel with alternatives retained at each branch:

1. Choose among the four subjects; retain **two**, not just the top one.
2. Within each retained subject, select **two grade/course branches**. Large routing lists are screened in bounded batches first.
3. Screen the expectations in those branches, retaining three per leaf batch.
4. Reduce if necessary and make a joint final Choice.

This usually explores four branches and averaged **13.1 calls per question**. Median whole-strategy time was **0.80 seconds**, costing about **$0.00194 per question**.

**Subject and grade/course are inferred retrieval decisions—not facts supplied by the user.** Once the correct branch is excluded, later selection cannot recover its standards. However, a wrong top-ranked subject is not automatically fatal because the second subject is retained too.

The traces are more specific than “B took a wrong turn”: **all 11 lost targets in this run were excluded at grade/course routing**. Math survived subject routing in those cases; none of these 11 losses was caused by subject pruning or subsequent leaf screening. This identifies where to test a wider branch selection next.

### C: semantic similarity plus keyword search

C combines two rankings over the same complete catalog:

- **Semantic:** embed the question, compute exact cosine similarity against all 4,888 stored vectors, and retain the top 40. This can retrieve related meaning despite different wording.
- **Keyword:** run BM25 over all expectation documents, retaining up to 40 with positive keyword scores. BM25 uses term frequency, document frequency and length normalization; this implementation does not stem words.
- **Merge:** reciprocal-rank fusion gives each candidate `sum(1 / (60 + rank))` over the lists where it appears, using one-based ranks. Rank positions avoid treating raw cosine and BM25 scores as directly comparable.
- Give the **top 30 fused candidates** to a final JEV Choice. In these runs that fit in one request.

Catalog vectors use `text-embedding-3-small`, **1,536 dimensions**. One-time preparation took **38.48 seconds** and cost approximately **$0.00716**. Each query then used two API calls—one embedding request and one JEV Choice—at about **$0.000161 per question**, with **0.52 seconds median** whole-strategy time. [OpenAI embedding model documentation](https://developers.openai.com/api/docs/models/text-embedding-3-small)

This is an **exact vector scan**, not an approximate index. Replacing storage with a vector database while keeping the same vectors, ranking and cutoff would not restore these missing candidates. Representation, the individual rank cutoffs, fusion and the final cutoff can all affect retention; final selection can still fail afterward.

## Catalog scope and evaluation truth

The catalog grew from 632 incomplete records to **4,888 published expectations**:

| Subject | Previous rows | Expanded rows |
| --- | ---: | ---: |
| Math | 33 | 1,096 |
| Science | 6 | 863 |
| English language arts / reading | 303 | 1,411 |
| Social studies | 290 | 1,518 |
| Total | 632 | **4,888** |

“Full” means locally published expectations in **all 16 linked A–D subchapter PDFs for TEA chapters 110–113**. It does not mean every TEKS subject or the contents of externally referenced AP/IB guides. Every supported subject includes K–8 and published secondary courses. Of 175 inventoried legal sections, 99 contain extracted expectations, 15 cover implementation, and 61 reference external curricula instead of publishing expectations locally. No external standards were fabricated. Official sources: [chapter 110](https://tea.texas.gov/laws-and-rules/texas-administrative-code/19-tac-chapter-110), [111](https://tea.texas.gov/laws-and-rules/texas-administrative-code/19-tac-chapter-111), [112](https://tea.texas.gov/laws-and-rules/texas-administrative-code/19-tac-chapter-112), [113](https://tea.texas.gov/laws-and-rules/texas-administrative-code/19-tac-chapter-113).

PDF extraction is deterministic, not model-authored. Records retain official text, parent statements, legal references, URLs, course titles and document hashes. Grade 0 denotes kindergarten; courses without one official grade are presented to selectors as `grade: null`. TAC-derived course identifiers are internal identifiers, not invented official abbreviations. Structural extraction checks and a source-page spot check are not an educator's line-by-line audit.

Ground truth comes from **TEA's official 2022 STAAR math answer-key alignments**, not another model's opinion: six text-based questions each from grades 3, 5 and 8. The compact evidence includes the exact source URLs and hashes. Previously only **5/18 target standards** existed; now **18/18 exist**. Each strategy ran twice, giving **108 predictions but only 18 unique questions**. Repeats are not independent new test examples. This reused public development set does not establish generalization, screenshot quality, or accuracy in the other three subjects.

## Original A/B/C results

| Measure | A: batches | B: hierarchy | C: hybrid |
| --- | ---: | ---: | ---: |
| Exact official code correct | **25/36 (69.4%)** | 20/36 (55.6%) | 18/36 (50.0%) |
| Previous partial-catalog result | 8/36 (22.2%) | 9/36 (25.0%) | 8/36 (22.2%) |
| Official target retained for final choice | **36/36** | 25/36 | 22/36 |
| Correct when target retained | 25/36 (69.4%) | 20/25 (80.0%) | 18/22 (81.8%) |
| Unknown / errors | 0 / 0 | 1 / 0 | 0 / 0 |
| Median whole-strategy time | 5,304 ms | 802 ms | 519 ms |
| p95 whole-strategy time | 5,836 ms | 908 ms | 636 ms |
| API calls across 36 trials | 3,405 | 470 | 72 |
| Estimated cost across 36 trials | $0.976118 | $0.069825 | $0.005806 |

Total known estimated cost including catalog embedding setup: **$1.05891022**. These are returned-token estimates, not invoices. Timings exclude lesson generation and image extraction. The full-catalog comparison also changed course representation and the handling of larger routing lists, so it is not a purely one-variable ablation against the older partial run.

### How to interpret conditional accuracy

The conditional scores expose **two bottlenecks**, but they do **not** establish that B/C are inherently better final selectors. All three use the same final JEV judgment. They retained different questions and supplied different competing candidates. Cases discarded by B/C may be harder, so comparing 25/36 with 20/25 or 18/22 changes the denominator and difficulty mix.

Even restricting to the **16 contexts where all three retained the official answer**, A scored 10/16, B 11/16 and C 12/16. That is a small observed difference, not a reliable population-level ranking, and the competing candidates still differ. The follow-up below instead holds the complete candidate lists fixed.

The defensible conclusion is:

> A had the best overall exact-match result because it retained every official target on this pilot. B and C were faster and cheaper but lost valid targets before selection. Improving their retention may improve accuracy, but we must measure whether broader lists increase ambiguity, latency or cost.

The hypothesis that A surfaces more confusing near-duplicates is plausible, not proven by these aggregate scores. Neither perfect retention nor subsecond A-level accuracy is guaranteed. The approximately **0.1-second** measurements in the follow-up below are **final-choice-only**, not full retrieval pipelines.

## Follow-up: improving the final choice

We implemented five variants on **A's exact frozen candidate lists**, without rerunning retrieval or removing candidates:

1. Original JEV Choice, rerun live as a contemporaneous baseline.
2. JEV with expanded instructions covering action, scope, representation and direct skill fit.
3. JEV with four independent Noul checks per candidate, followed by a final Choice informed by those checks. Candidates are ordered by their weakest check, but none is discarded. This ordering is a heuristic, not a probability calculation.
4. One GPT-4.1 structured-output selection.
5. Three parallel GPT-4.1 selections with strict majority voting.

TypeSafe's skill guided the narrow per-candidate judgments and separation of confidence from correctness. OpenAI Docs guided enum-constrained structured output and snapshot selection. Models were pinned to JEV `jev-1.13.0` and `gpt-4.1-2025-04-14`. The GPT prompt/schema is deliberately isolated from production's richer classification prompt; it is **not an exact replay of the live classifier**. A three-way vote tie would return unknown; a failed vote sample would fail the trial. No automatic retries or fallback occurred. [TypeSafe reranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe), [Noul](https://docs.typesafe.ai/primitives/noul), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

### Anonymous questions: no supplied grade

| Final selector | Exact correct | Median selector time | Estimated cost / 36 predictions |
| --- | ---: | ---: | ---: |
| Original JEV Choice, fresh run | 24/36 (66.7%) | 116 ms | $0.003256 |
| JEV expanded instructions | 26/36 (72.2%) | **114 ms** | $0.003449 |
| JEV per-candidate rubric + Choice | 28/36 (77.8%) | 568 ms | $0.034995 |
| GPT-4.1 single | 28/36 (77.8%) | 552 ms | $0.135140 |
| GPT-4.1 three-vote | **29/36 (80.6%)** | 598 ms | $0.299460 |

The fresh original-JEV baseline is 24/36, versus 25/36 in the previous run, despite identical reconstructed requests. That is run-to-run variability, not a changed denominator or silently discarded result.

Against the fresh baseline, instructions alone fixed two outcomes with no regressions. The rubric fixed five but broke one, net +4. GPT single fixed eight but broke four; voting fixed eight but broke three. Voting bought **one additional correct repeated trial**, not a decisive accuracy win, at over twice the measured single-call cost; cache discounts mean billed cost was not exactly threefold.

These selector times exclude A's screening. Attaching the rubric selector to A does **not** turn the complete pipeline into a 568-ms system. Nor have we demonstrated the same gains on B/C's different candidate sets.

### Supplied assessment grade: a separate information condition

For this experiment only, we supplied the official assessment grade as metadata. This simulates a user genuinely knowing the grade. It is an **oracle-metadata ablation**, not a grade-inference result and not evidence that we can infer grade with this accuracy. The standard label and subject were still withheld, and no candidates were filtered out.

| Final selector | Exact correct | Median selector time |
| --- | ---: | ---: |
| Original JEV Choice | **34/36 (94.4%)** | 117 ms |
| JEV expanded instructions | **34/36 (94.4%)** | 113 ms |
| JEV rubric + Choice | 32/36 (88.9%) | 572 ms |
| GPT-4.1 single | 33/36 (91.7%) | 532 ms |
| GPT-4.1 three-vote | 33/36 (91.7%) | 592 ms |

**More processing was not uniformly better.** With supplied grade, the rubric introduced two errors relative to the simple JEV baseline; each GPT variant introduced one. This argues against deploying an elaborate selector unconditionally.

Across both conditions: **360 predictions, zero provider/validation errors, zero abstentions, and $0.93706261 estimated usage**. No abstentions on this in-catalog set do not establish safe abstention on missing-label or out-of-domain inputs.

## Ambiguity and remaining failures

Some exact-code errors are genuine distinctions the selector missed; others reflect overlapping curricular coverage.

- **Grade overlap:** the grade-3 comparison question uses numbers below 1,200. Both `2.2D` (up to 1,200) and `3.2D` (up to 100,000) plausibly cover that skill. Question content alone need not reveal the original assessment grade.
- **Duplicate expectations:** `7.13E`, `8.12D` and an advanced-grade-7 course expectation have the same interest-calculation wording after terminal punctuation/conjunction normalization. A related course's code is still a wrong exact official label; it is not necessarily an unrelated skill.
- **Task distinction:** for the coordinate-plotting item, official `5.8B` concerns the graphing process, while selectors often choose `5.8A`, concerning coordinate-plane attributes. In the follow-up, GPT corrected one anonymous repetition but not the other; supplying grade did not fix it. The rubric did not solve this case.
- **Regression:** extra rubric judgments can steer a previously correct choice toward a neighboring linear-equation standard. Their outputs are fallible evidence, not an independent ground-truth oracle.

Official exact-code accuracy remains the primary metric. The evidence also records normalized expectation-text equality as a narrow diagnostic; it is **not** educator-validated semantic accuracy. Broader compatibility and legitimate alternative alignments need a separate review set, not labels manufactured by the model being evaluated.

## Confidence is not an accuracy guarantee

In the original full A/B/C run, accepting only predictions with confidence at least .95 gave A **4/4**, B **6/8**, and C **8/10** exact matches. C assigned .99 and 1.00 to the same wrong official-code match when its correct target was missing from the shortlist. B's two high-confidence exact-code errors selected a duplicate expectation in another course.

For anonymous questions in the fixed-list follow-up, the rubric's ≥.95 group was **6/6**, but that covers only six repeated outcomes, not proof of 100% reliability. Both experiments' complete confidence bins and threshold counts are in the evidence file. GPT vote agreement is not presented as a calibrated probability. [TypeSafe confidence documentation](https://docs.typesafe.ai/confidence)

## Recommended next steps

1. **Use genuinely supplied grade/course context when available**, while keeping an anonymous-input mode that reports ambiguity honestly. Do not silently inject evaluator labels into that mode.
2. **Keep the instruction-only and rubric variants as candidates**, not a declared winner. On anonymous inputs, the rubric improved the observed result at extra cost; with known grade it regressed.
3. **Test wider grade/course routing for B**, since that caused all 11 recorded retention losses. For C, test broader candidate unions, cutoffs and skill-focused query representations. Re-measure both recall and selection as lists grow.
4. **Do not default to three GPT votes based on this result.** Its one-trial advantage over one GPT call is too small to justify a general claim. A selective verifier/escalation path remains a hypothesis to evaluate, not a deployed feature.
5. **Validate on a larger untouched official dataset**, with version-aware labels, other subjects, diagram questions and missing-target cases. The present experiments still contain only 18 unique development questions. Neither a production threshold nor a guarantee of accuracy follows from them.

## Evidence and verification

[Download the compact evidence and per-trial observations](full-catalog-benchmark-evidence.json). It includes both experiments' metrics, official question/answer-key source URLs and hashes, model versions, catalog hash, candidate keys, selections, costs, confidence, and diagnostic counts. It excludes full question text, API credentials, private correspondence and student submissions.

Full raw traces are retained locally under the SHA-256 fingerprints recorded in the compact evidence; they are not all included in this documentation-only publication. In the first experiment, a Windows checkpoint rename failed after trial 72; the validated temporary checkpoint was recovered, the first 71 records were verified unchanged, and only the remaining trials were run. Overlapping checkpoint costs were not summed twice.

Verification completed:

- Independent recomputation of trial completeness, selections, summaries and usage costs.
- Reconstruction and hash verification of **all 1,612 provider requests** in the selector follow-up, confirming the intended question/context/candidate inputs. All **36 anonymous baseline request hashes** match their original A final-choice requests.
- Source/dataset/catalog hashes, official labels, selected-grade hydration and append-only evidence journal verified.
- **34 classification-focused automated tests passed**, including 13 new selector/report tests; isolated classification TypeScript checking and focused ESLint passed.
- Publication checks exclude known credentials and private files. This is not a claim of a fresh whole-app build, UI regression run or production deployment.

The expanded catalog and experimental selectors remain offline artifacts. **This report does not claim the live app already uses the 4,888-row catalog or these experimental selectors.**
