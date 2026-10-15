# Lesson design

How lessons are structured, why, and where each decision is enforced.

This replaces the first lesson format, which was a schema wrapped around whatever
the model wanted to write (objective, explanation, worked example, mistakes,
practice). That format had no model of how a student learns the skill. The new
format is based on the reference deck from the staff engineer ("Sentence Power!").

## 1. What the reference deck does

Eight steps plus three storyboard notes. Each one carries a specific job.

| Reference step | What the student does | Job |
| --- | --- | --- |
| 1 Title | Reads a goal in one line | Hook, state the objective, name the skill |
| 2 Big idea | Taps once and watches two pieces become one | Concrete example first, rule second |
| 3 Teach | Taps each joining word | Varied cases, one repeated check |
| 4 Cover test | Flips one switch per half of two sentences | Contrasting example and non-example, a named self-check |
| 5 Practice | Picks one of three sentences that all contain "and" | Retrieval where surface features cannot give the answer away |
| 6 Practice, correct | Reads why it is right | Feedback that explains, using the parts |
| 7 Quiz | Answers three items, sees nothing until done | Independent retrieval with a visible pass mark (80%) |
| 8 Recap | Reads three lines | Consolidation, ending on the misconception |
| Storyboards 2, 3, 4 | n/a | The states an interactive slide moves through |

Things worth noticing that are easy to miss:

- **The non-example is a minimal pair.** "I made a snowman, and my brother made an
  igloo." against "I made a snowman and threw a snowball." They differ in one thing,
  the thing students get wrong.
- **The wrong options in practice all contain "and".** The surface cue is removed
  as a way to answer, so the student must use the check.
- **The last recap line is the misconception**, not a fourth fact:
  "Not every 'and' joins two sentences."
- **Colour and shape mean the same thing on every slide.** The comma is always a
  yellow chip. The joining word is always a teal pill.
- **The same hint appears in practice and disappears in the quiz.**

## 2. Ingredients, and where each one lives

| Ingredient | Why it matters | Schema field | Enforced by |
| --- | --- | --- | --- |
| One skill, one misconception, decided first | Every distractor and the recap warning then target the same error | `plan.coreMisconception` is the first field written | Schema order; prompt; quality check `misconception-echo`; schema requires one quiz item with `targetsMisconception` |
| Concrete before abstract | The rule is easier to hold after seeing it happen | `bigIdea.before`, `after`, then `rule` | Prompt; warning `before-reveals` when the joining word is already on the card |
| Consistent signalling (dual coding) | Attention goes to the part that matters | `Segment.role`: `key`, `mark`, `focus`, `plain` | One renderer for every slide; legend generated from `annotations` |
| Varied examples, one invariant | Seeing what changes and what does not | `teach.cases[]`, each with `check` and `holds` | Prompt; `holds: false` allowed for a contrasting case |
| Contrasting cases | Makes the misconception visible | `strategy.example`, `strategy.nonExample` | Schema: every example part holds, at least one non-example part fails |
| A named, reusable self-check | Transfers to items the lesson never showed | `strategy.name`, `instruction`, `rule` | Prompt; rule unlocks only after the student tested every part |
| Student acts before seeing | Generating beats reading | Tap to join, tap a case, flip a switch | Player state machine, unit tested |
| Retrieval with explaining feedback | A wrong answer is a chance to correct the idea | `guidedPractice.options[].feedback` | Quality check `feedback-thin`; schema: exactly one correct option; options shuffled after generation |
| Retries, then the answer | Productive struggle without a dead end | n/a | Two misses reveal the answer (`MAX_WRONG_PICKS`) |
| Fading support | Hint in practice, none in the quiz | `guidedPractice.hint` only | Structure |
| Independent retrieval with a pass mark | The score means something | `quiz.items[]`, 80% (`PASS_THRESHOLD`) | Schema: `answerIndex` valid; quality checks for same-answer and recycled items |
| Consolidation | Three things to repeat tomorrow | `recap.takeaways` (2) and `watchOut` | Schema lengths |
| Low load | One idea per slide, short text, student paces | Seven screens, text budgets | Prompt word limits; reading-level warning by grade |
| Accessibility | Not everyone sees colour | n/a | Icons and words beside every colour; keyboard and screen-reader support; contrast tokens |

Principles referred to, as pointers rather than citations: Gagné's events of
instruction, Rosenshine's principles of instruction, Mayer's multimedia principles
(signalling, segmenting), cognitive load theory, concreteness fading, variation
theory, the testing effect, and formative feedback research.

## 3. How generation works

```
question + classification
   → one structured model call, plan written first
   → Zod: shape and cross-field rules          (schema issues → one repair pass)
   → normalise: shuffle answer positions       (deterministic, no model)
   → pedagogy checks: fix | warn               (fix → one repair pass)
   → keep the better draft; store issues, attempts and repair reason with the lesson
```

- **One call, not a chain.** Plan-first ordering inside one structured response
  gets most of the benefit of a plan step without doubling latency. Measured
  against the five test questions: 6 to 16 seconds, four of five on the first try.
- **The model fills a pedagogical frame; it does not choose one.** The order of
  slides and the fields are fixed. The prompt names the principle each slide serves.
- **Deterministic checks sit outside the prompt** (`src/server/ai/lesson-quality.ts`)
  so they are testable offline and cannot be talked out of by the model.
- **Nothing here verifies that the maths or science is correct.** See section 6.

`rawResponse` on the lesson row keeps `attempts`, `repair`, `repairFailure` and
`quality`, so a prompt change can be judged against stored evidence.

## 4. How it is built in the interface

The student view is `src/components/lesson/`. It was designed in Paper first.

- **Paper file:** "Lesson Pipeline UI", page "Lesson Slides". Thirteen artboards:
  the eight reference steps, wrong-answer and quiz-result states, the player
  navigation, and the teacher panel. Tokens are prefixed `--color-slide-*`.
- **Code:** `globals.css` registers the same tokens, so classes exported from
  Paper (`bg-slide-teal-soft`, `text-slide-h1`, `tracking-label`) work unchanged.
  Fluid utilities (`slide-h1`, `slide-lead`, ...) scale the 1280 x 720 design to
  any container with container queries.
- **State:** `src/lib/lesson-deck.ts` is a pure reducer and scoring module, shared
  by the player and the tests.
- **Teacher view:** the lesson page shows the plan and "why this order" in a
  collapsed panel, so the reasoning is inspectable without cluttering the student.

Deliberate differences from the reference, both for contrast:

| Reference | Here | Why |
| --- | --- | --- |
| Teal `#1AA6C4` for text and controls (2.9:1 on white) | `#00708E` (5.7:1), brand teal kept for decoration | Passes 4.5:1 on its tints |
| Sky gradient light at the top left behind white copy | Dark at left, light behind the mascot | White copy at the light end was 2.5:1 |

## 5. Slide-to-screen mapping

The deck is seven screens. Reference steps 5 and 6 are the same screen before and
after the student answers.

## 6. Limits and next steps

- **Correctness of content is not checked.** Structure and pedagogy are enforced;
  facts are not. The grade 10 sample's strategy text was muddled. Next: a judge
  pass with a second model, plus subject-matter review of a sample set.
- **The template strains outside grammar and arithmetic.** The tap-to-join and
  switch interactions fit "two pieces make one" skills best. Science
  classification worked (physical or chemical) but the switches read less
  naturally. Next: two or three interaction variants selected by skill type.
- **Small evidence base.** Five generated lessons, no students. The checks
  measure structure, not learning. Next: pilot with a class, track quiz pass rate.
- **No spacing or interleaving across lessons.** A single lesson cannot do this.
  Next: revisit items from earlier lessons in later quizzes.
- **Quiz feedback is delayed on purpose**, as in the reference. For a first
  encounter with hard material immediate feedback is often better. Worth testing.
- **Accessibility is considered, not audited.** Keyboard, labels, contrast and
  reduced motion are handled. A screen-reader pass has not been done.
- **Paper and code differ in one place.** The sky gradient endpoints in code
  (`#0d7c97` to `#25b6d6`, left to right) are not yet in the Paper file, which
  still has the reference values. The Paper free-tier MCP limit was reached
  during export, so Tailwind JSX was exported for six of the thirteen artboards
  (title, big idea, big idea before tap, teach, strategy, practice). The other
  seven were ported from the same HTML that was written to Paper. Re-export and
  update the gradient tokens after the limit resets.

## 7. Verify

```bash
npm test                  # includes tests/lesson.test.ts (schema, checks, state, generator retries)
npm run lint
npm run typecheck
npm run build
```
