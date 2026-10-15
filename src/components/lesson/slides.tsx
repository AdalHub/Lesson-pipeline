import { Fragment, type Dispatch, type ReactNode } from 'react';
import type { Lesson } from '@/server/ai/schemas';
import {
  answersNeededToPass,
  legendItems,
  partState,
  PASS_THRESHOLD,
  scoreQuiz,
  splitTitle,
  strategyUnlocked,
  titleSize,
  cardComplete,
  type CardId,
  type DeckAction,
  type DeckState,
} from '@/lib/lesson-deck';
import {
  ActionButton,
  Chip,
  Eyebrow,
  Heading,
  Icon,
  Lead,
  MascotArt,
  Segments,
  SlideBody,
  SlideFrame,
  Sparkles,
} from './parts';

export type SlideProps = {
  lesson: Lesson;
  state: DeckState;
  dispatch: Dispatch<DeckAction>;
};

/** "Sam hung it up." -> "Sam hung it up", so a sentence we add after it does not double the full stop. */
const trimEnd = (text: string) => text.replace(/[.!?\s]+$/, '');

const FOCUS =
  'outline-offset-4 focus-visible:outline-[3px] focus-visible:outline-slide-teal-strong';

function ResultPanel({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="slide-enter flex flex-col items-center gap-[clamp(0.6rem,1.25cqw,1rem)] rounded-slide-lg border-2 border-slide-teal-soft bg-slide-teal-wash px-[clamp(1rem,2.5cqw,2rem)] py-[clamp(0.9rem,2cqw,1.6rem)] text-center"
    >
      {children}
    </div>
  );
}

function Caps({ children }: { children: ReactNode }) {
  return (
    <p className="font-slide-body text-[0.875rem] font-extrabold uppercase tracking-label text-slide-teal-strong">
      {children}
    </p>
  );
}

function Chevron() {
  return (
    <div className="flex justify-center text-slide-ink-soft" aria-hidden="true">
      <Icon name="chevronDown" className="h-5 w-5" />
    </div>
  );
}

/* ------------------------------ 1 · title -------------------------------- */

export function TitleSlide({
  lesson,
  gradeLevel,
  onStart,
}: {
  lesson: Lesson;
  gradeLevel: number;
  onStart: () => void;
}) {
  const { head, tail } = splitTitle(lesson.title);
  return (
    <SlideFrame tone="sky" label="Title">
      <div className="relative flex flex-1 flex-col @3xl:flex-row">
        <div className="slide-pad-x slide-pad-y flex flex-1 flex-col justify-center gap-[clamp(0.75rem,1.7cqw,1.4rem)] @3xl:w-[55%] @3xl:flex-none">
          <Eyebrow tone="glass" icon="star">
            Grade {gradeLevel} · {lesson.topic}
          </Eyebrow>
          <h2
            data-slide-heading
            tabIndex={-1}
            className={`font-slide-display font-bold tracking-[-0.02em] outline-none ${titleSize(lesson.title)}`}
          >
            {head && <span className="block text-paper">{head}</span>}
            <span className="block text-slide-sun">{tail}</span>
          </h2>
          <p className="slide-tile font-slide-display font-semibold text-paper">{lesson.skill}</p>
          <p className="slide-lead font-slide-body font-semibold text-paper">{lesson.objective}</p>
          <div className="pt-1">
            <button
              type="button"
              onClick={onStart}
              className={`inline-flex items-center gap-2.5 rounded-full bg-paper px-6 py-3 font-slide-display text-xl font-bold text-slide-teal-strong transition hover:brightness-95 ${FOCUS}`}
            >
              Let&rsquo;s go
              <Icon name="arrowRight" className="h-5 w-5" strokeWidth={3} />
            </button>
          </div>
        </div>
        <div className="relative flex items-center justify-center px-[8%] pb-[5%] @3xl:flex-1 @3xl:px-0 @3xl:pb-0">
          <MascotArt
            words={lesson.keyTerms.join('  ')}
            className="w-[min(62cqw,15rem)] @3xl:w-[66%]"
          />
        </div>
        <Sparkles />
      </div>
    </SlideFrame>
  );
}

/* ----------------------------- 2 · big idea ------------------------------ */

function SentenceCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="w-full rounded-slide-md border-2 border-slide-line bg-slide-surface px-[1.7cqw] py-[1.25cqw] max-@xl:px-4 max-@xl:py-3 @xl:w-[21cqw]">
      <p className="font-slide-body text-xs font-extrabold uppercase tracking-label text-slide-ink-soft">
        {label}
      </p>
      <p className="font-slide-display text-[clamp(1.125rem,2.03cqw,1.625rem)] font-bold leading-tight text-slide-ink">
        {children}
      </p>
    </div>
  );
}

function LegendItem({
  role,
  label,
  text,
}: {
  role: 'key' | 'mark';
  label: string;
  text: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {role === 'mark' ? (
        <span className="rounded-lg bg-slide-sun-soft px-2 font-slide-display text-lg font-bold text-slide-ink">
          {text}
        </span>
      ) : (
        <span className="rounded-full border-2 border-slide-teal-strong px-3 font-slide-display text-base font-bold text-slide-teal-strong">
          {text}
        </span>
      )}
      <span className="slide-small font-slide-body font-semibold text-slide-ink-soft">{label}</span>
    </span>
  );
}

export function BigIdeaSlide({ lesson, state, dispatch }: SlideProps) {
  const b = lesson.bigIdea;
  const single = b.before.length === 1;
  const legend = legendItems(b);
  return (
    <SlideFrame label="Big idea">
      <SlideBody>
        <Eyebrow>The big idea</Eyebrow>
        <Heading>{b.heading}</Heading>
        <Lead>
          {b.rule}
          {state.joined ? '' : ' Tap to see it happen.'}
        </Lead>

        <div className="flex flex-col items-center gap-[clamp(0.5rem,1.1cqw,0.9rem)]">
          <div className="flex w-full flex-col items-center justify-center gap-3 @xl:flex-row @xl:gap-[1.4cqw]">
            {b.before.map((text, i) => (
              <Fragment key={i}>
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slide-ink font-slide-display text-2xl font-bold text-paper"
                  >
                    +
                  </span>
                )}
                <SentenceCard label={single ? b.partLabel : `${b.partLabel} ${i + 1}`}>
                  {text}
                </SentenceCard>
              </Fragment>
            ))}
          </div>

          {state.joined ? (
            <button
              type="button"
              onClick={() => dispatch({ type: 'unjoin' })}
              className={`inline-flex items-center gap-2 rounded-full border-2 border-slide-line bg-paper px-4 py-1.5 font-slide-body text-sm font-extrabold uppercase tracking-label text-slide-ink-soft hover:border-slide-ink-soft ${FOCUS}`}
            >
              <Icon name="refresh" className="h-4 w-4" />
              Start over
            </button>
          ) : (
            <ActionButton icon="pointer" onClick={() => dispatch({ type: 'join' })}>
              {b.actionLabel}
            </ActionButton>
          )}
          <Chevron />
        </div>

        {state.joined ? (
          <ResultPanel>
            <Segments items={b.after} keyStyle="outline" />
            {legend.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-x-[3cqw] gap-y-2">
                {legend.map((item) => (
                  <LegendItem key={`${item.role}-${item.label}`} {...item} />
                ))}
              </div>
            )}
          </ResultPanel>
        ) : (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center rounded-slide-lg border-[3px] border-dashed border-slide-teal-soft px-6 py-[clamp(1.25rem,3.6cqw,2.9rem)] text-center"
          >
            <p className="font-slide-body text-lg font-bold text-slide-ink-soft">
              Tap the button to see what happens.
            </p>
          </div>
        )}
      </SlideBody>
    </SlideFrame>
  );
}

/* ------------------------------- 3 · teach ------------------------------- */

export function TeachSlide({ lesson, state, dispatch }: SlideProps) {
  const t = lesson.teach;
  const current = t.cases[state.caseIndex] ?? t.cases[0]!;
  return (
    <SlideFrame label="Teach">
      <SlideBody>
        <Eyebrow icon="list">{t.label}</Eyebrow>
        <Heading>{t.heading}</Heading>
        <Lead>{t.prompt}</Lead>

        <div
          role="group"
          aria-label={t.heading}
          className="flex flex-wrap items-center justify-center gap-[1.4cqw] pt-1 max-@xl:gap-2.5"
        >
          {t.cases.map((c, i) => {
            const on = i === state.caseIndex;
            return (
              <button
                key={c.name}
                type="button"
                aria-pressed={on}
                onClick={() => dispatch({ type: 'case', index: i })}
                className={`min-h-14 min-w-[7.4cqw] rounded-full px-[2.2cqw] font-slide-display text-[clamp(1.25rem,2.66cqw,2.125rem)] font-bold transition max-@xl:px-5 ${FOCUS} ${
                  on
                    ? 'bg-slide-teal-strong text-paper shadow-[0_12px_22px_rgba(0,112,142,0.32)]'
                    : 'border-[3px] border-slide-teal-strong bg-paper text-slide-teal-strong hover:bg-slide-teal-wash'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <Chevron />

        <ResultPanel>
          <Caps>
            {current.name} · {current.meaning}
          </Caps>
          <Segments items={current.example} keyStyle="filled" />
          <Chip kind={current.holds ? 'ok' : 'bad'}>{current.check}</Chip>
        </ResultPanel>
        <p className="text-center font-slide-body text-sm font-bold text-slide-ink-soft">
          {state.seenCases.length} of {t.cases.length} explored
        </p>
      </SlideBody>
    </SlideFrame>
  );
}

/* ------------------------------ 4 · strategy ----------------------------- */

function StrategyCard({
  kind,
  card,
  tested,
  onTest,
}: {
  kind: CardId;
  card: Lesson['strategy']['example'];
  tested: boolean[];
  onTest: (part: number) => void;
}) {
  const isExample = kind === 'example';
  const done = cardComplete(tested);
  const allHold = card.parts.every((p) => p.holds);
  return (
    <div className="flex flex-1 flex-col gap-3.5 rounded-slide-lg border-2 border-slide-line bg-slide-surface p-[clamp(1rem,1.9cqw,1.5rem)]">
      <p
        className={`w-fit rounded-full px-3.5 py-1 font-slide-body text-[0.8125rem] font-extrabold uppercase tracking-label ${
          isExample
            ? 'bg-slide-teal-soft text-slide-teal-strong'
            : 'bg-slide-pink-soft text-slide-pink-strong'
        }`}
      >
        {isExample ? 'Example' : 'Non-example'}
      </p>
      <p className="font-slide-display text-[clamp(1.0625rem,1.8cqw,1.4375rem)] font-bold leading-snug text-slide-ink">
        {card.statement}
      </p>
      <ul className="flex flex-col gap-2.5">
        {card.parts.map((part, i) => {
          const state = partState(tested[i] ?? false, part.holds);
          const track = {
            untested: 'bg-slide-line',
            holds: 'bg-slide-teal-strong',
            fails: 'bg-slide-pink-fill',
          }[state];
          return (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <button
                type="button"
                role="switch"
                aria-checked={tested[i] ?? false}
                aria-label={`Test “${part.text}” on its own`}
                onClick={() => onTest(i)}
                className={`flex min-w-[9.5rem] flex-1 items-center gap-3.5 text-left ${FOCUS}`}
              >
                <span
                  aria-hidden="true"
                  className={`slide-motion flex h-8 w-14 shrink-0 items-center rounded-full p-[3px] transition-colors ${track}`}
                >
                  <span
                    className={`slide-motion block h-[26px] w-[26px] rounded-full bg-paper shadow-[0_1px_3px_rgba(32,34,58,0.3)] transition-transform ${
                      state === 'holds' ? 'translate-x-6' : ''
                    }`}
                  />
                </span>
                <span className="font-slide-body text-[clamp(1rem,1.4cqw,1.125rem)] font-bold text-slide-ink">
                  {part.text}
                </span>
              </button>
              <span aria-live="polite">
                {state === 'untested' ? (
                  <Chip kind="idle">Tap to test</Chip>
                ) : (
                  <Chip kind={part.holds ? 'ok' : 'bad'}>{part.verdict}</Chip>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite" className="min-h-11">
        {done && (
          <span
            className={`slide-enter inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 font-slide-display text-xl font-bold text-paper ${
              allHold ? 'bg-slide-teal-strong' : 'bg-slide-pink-fill'
            }`}
          >
            <Icon name={allHold ? 'check' : 'x'} className="h-5 w-5" strokeWidth={3} />
            {card.conclusion}
          </span>
        )}
      </div>
    </div>
  );
}

export function StrategySlide({ lesson, state, dispatch }: SlideProps) {
  const s = lesson.strategy;
  const unlocked = strategyUnlocked(state);
  return (
    <SlideFrame label="Strategy">
      <SlideBody>
        <Eyebrow tone="pink" icon="sliders">
          {s.label}
        </Eyebrow>
        <Heading>{s.name}</Heading>
        <Lead>{s.instruction}</Lead>

        <div className="flex flex-col gap-4 @3xl:flex-row @3xl:gap-[1.9cqw]">
          <StrategyCard
            kind="example"
            card={s.example}
            tested={state.tested.example}
            onTest={(part) => dispatch({ type: 'test', card: 'example', part })}
          />
          <StrategyCard
            kind="nonExample"
            card={s.nonExample}
            tested={state.tested.nonExample}
            onTest={(part) => dispatch({ type: 'test', card: 'nonExample', part })}
          />
        </div>

        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-3.5 rounded-slide-lg px-[clamp(1rem,1.9cqw,1.5rem)] py-3.5 ${
            unlocked
              ? 'slide-enter bg-slide-sun-soft'
              : 'border-[3px] border-dashed border-slide-sun bg-paper'
          }`}
        >
          <Icon
            name={unlocked ? 'star' : 'lock'}
            filled={unlocked}
            strokeWidth={2.2}
            className={`h-6 w-6 ${unlocked ? 'text-slide-sun' : 'text-slide-sun-strong'}`}
          />
          <p
            className={`font-slide-display text-[clamp(1.0625rem,1.64cqw,1.3125rem)] font-bold leading-snug ${
              unlocked ? 'text-slide-ink' : 'text-slide-ink-soft'
            }`}
          >
            {unlocked
              ? s.rule.replace(/\s*->\s*/g, ' → ')
              : 'Test every part of both sentences to unlock the rule.'}
          </p>
        </div>
      </SlideBody>
    </SlideFrame>
  );
}

/* ----------------------------- 5-6 · practice ---------------------------- */

export function PracticeSlide({ lesson, state, dispatch }: SlideProps) {
  const g = lesson.guidedPractice;
  const p = state.practice;
  const correctIndex = g.options.findIndex((o) => o.correct);
  const shown = p.lastPick !== null ? g.options[p.lastPick] : null;
  const shownCorrect = p.lastPick === correctIndex;

  return (
    <SlideFrame label="Practice">
      <SlideBody>
        <Eyebrow tone="pink" icon="star">
          Your turn · Practice
        </Eyebrow>
        <Heading>{g.question}</Heading>
        <Lead>{g.reminder}</Lead>

        <ul className="grid gap-4 pt-1 @2xl:grid-cols-3 @2xl:gap-[1.9cqw]">
          {g.options.map((option, i) => {
            const isCorrect = p.solved && i === correctIndex;
            const isWrong = p.wrongPicks.includes(i);
            const dimmed = p.solved && !isCorrect && !isWrong;
            const tone = isCorrect
              ? 'border-transparent bg-slide-teal-strong text-paper shadow-[0_18px_32px_rgba(0,112,142,0.35)]'
              : isWrong
                ? 'border-slide-pink-fill border-[3px] bg-slide-pink-soft text-slide-ink'
                : dimmed
                  ? 'border-slide-line bg-slide-surface text-slide-ink-soft'
                  : 'border-slide-line bg-paper text-slide-ink hover:border-slide-teal-strong';
            return (
              <li key={i} className="relative">
                <button
                  type="button"
                  disabled={p.solved || isWrong}
                  aria-pressed={isCorrect || isWrong}
                  onClick={() => dispatch({ type: 'pick', index: i })}
                  className={`slide-motion flex min-h-[clamp(5rem,11.4cqw,9.1rem)] w-full items-center rounded-slide-lg border-2 px-[clamp(1rem,2cqw,1.6rem)] py-3 text-left font-slide-display text-[clamp(1.0625rem,1.8cqw,1.4375rem)] font-bold leading-snug transition disabled:cursor-default ${FOCUS} ${tone}`}
                >
                  {option.text}
                </button>
                {(isCorrect || isWrong) && (
                  <span
                    aria-hidden="true"
                    className={`absolute -right-2.5 -top-3 flex h-12 w-12 items-center justify-center rounded-full shadow-[0_6px_14px_rgba(32,34,58,0.2)] ${
                      isCorrect ? 'bg-paper text-slide-teal-strong' : 'bg-slide-pink-fill text-paper'
                    }`}
                  >
                    <Icon name={isCorrect ? 'check' : 'x'} className="h-6 w-6" strokeWidth={3.4} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          {shown ? (
            <div
              className={`slide-enter flex items-start gap-5 rounded-slide-lg border-2 p-[clamp(1rem,2cqw,1.6rem)] ${
                shownCorrect
                  ? 'border-slide-teal-strong bg-slide-teal-soft'
                  : 'border-slide-pink-fill bg-slide-pink-soft'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-paper ${
                  shownCorrect ? 'bg-slide-teal-strong' : 'bg-slide-pink-fill'
                }`}
              >
                <Icon name={shownCorrect ? 'check' : 'bang'} className="h-7 w-7" strokeWidth={3.4} />
              </span>
              <div className="flex flex-col gap-1">
                <p
                  className={`font-slide-display text-[clamp(1.375rem,2.34cqw,1.875rem)] font-bold leading-tight ${
                    shownCorrect ? 'text-slide-teal-strong' : 'text-slide-pink-strong'
                  }`}
                >
                  {shownCorrect ? (p.revealed ? 'Here is the answer.' : 'Correct!') : 'Not quite. Try again!'}
                </p>
                <p className="slide-lead font-slide-body font-semibold text-slide-ink">
                  {shown.feedback}
                </p>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-3.5 font-slide-body text-[clamp(1.0625rem,1.875cqw,1.5rem)] font-medium leading-snug text-slide-ink-soft">
              <Icon name="help" className="h-6 w-6 text-slide-pink-strong" strokeWidth={2.6} />
              {g.hint}
            </p>
          )}
        </div>
      </SlideBody>
    </SlideFrame>
  );
}

/* ------------------------------- 7 · quiz -------------------------------- */

/** Colour by position for short paired choices; one tone for longer lists. */
const CHOICE_TONES = [
  'border-slide-teal-strong bg-slide-teal-wash text-slide-teal-strong',
  'border-slide-orange-strong bg-slide-orange-soft text-slide-orange-strong',
  'border-slide-pink-strong bg-slide-pink-soft text-slide-pink-strong',
  'border-slide-sun-strong bg-slide-sun-soft text-slide-sun-strong',
] as const;

export function QuizSlide({
  lesson,
  state,
  dispatch,
  onContinue,
}: SlideProps & { onContinue: () => void }) {
  const q = lesson.quiz;
  const { answers, submitted, attempts } = state.quiz;
  const answered = answers.filter((a) => a !== null).length;
  const score = scoreQuiz(answers, q.items);
  const pass = Math.round(PASS_THRESHOLD * 100);

  if (submitted) {
    const need = answersNeededToPass(score);
    return (
      <SlideFrame label="Quiz results">
        <SlideBody>
          <Eyebrow tone="sun" icon="star">
            Quiz · Your results
          </Eyebrow>
          <div className="flex flex-wrap items-center gap-x-[2.2cqw] gap-y-2">
            <p className="font-slide-display text-[clamp(2.5rem,5.6cqw,4.5rem)] font-bold leading-none tracking-[-0.02em] text-slide-teal-strong">
              {score.correct} / {score.total}
            </p>
            <div>
              <h2
                data-slide-heading
                tabIndex={-1}
                className="font-slide-display text-[clamp(1.375rem,2.34cqw,1.875rem)] font-bold leading-tight text-slide-ink outline-none"
              >
                {score.passed ? 'You passed!' : `So close! You need ${pass}% to pass.`}
              </h2>
              <p className="slide-small font-slide-body font-medium text-slide-ink-soft">
                {score.passed
                  ? 'Read each explanation, then head to the recap.'
                  : `Get ${need} more right. Read why below, then try again.`}
              </p>
            </div>
          </div>

          <ol className="flex flex-col gap-3">
            {q.items.map((item, i) => {
              const ok = score.perItem[i]!;
              const picked = answers[i];
              return (
                <li
                  key={i}
                  className={`flex items-start gap-4 rounded-[22px] border-2 px-[clamp(0.9rem,1.7cqw,1.4rem)] py-3.5 ${
                    ok
                      ? 'border-slide-teal-soft bg-slide-teal-wash'
                      : 'border-slide-pink-fill bg-slide-pink-soft'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-paper ${
                      ok ? 'bg-slide-teal-strong' : 'bg-slide-pink-fill'
                    }`}
                  >
                    <Icon name={ok ? 'check' : 'x'} className="h-[18px] w-[18px]" strokeWidth={3.4} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="font-slide-display text-[clamp(1.0625rem,1.72cqw,1.375rem)] font-bold leading-snug text-slide-ink">
                      <span className="sr-only">{ok ? 'Correct. ' : 'Incorrect. '}</span>
                      {item.prompt}
                    </p>
                    <p className="slide-small font-slide-body font-semibold text-slide-ink-soft">
                      You said: {picked !== null ? trimEnd(item.choices[picked]!) : '—'}.
                      {!ok && ` Right answer: ${trimEnd(item.choices[item.answerIndex]!)}.`}{' '}
                      {item.explanation}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center gap-3">
            {score.passed ? (
              <ActionButton tone="teal" icon="arrowRight" onClick={onContinue}>
                Finish
              </ActionButton>
            ) : (
              <ActionButton icon="refresh" onClick={() => dispatch({ type: 'retry' })}>
                Try again
              </ActionButton>
            )}
            {attempts > 0 && (
              <span className="slide-small font-slide-body font-bold text-slide-ink-soft">
                Attempt {attempts + 1}
              </span>
            )}
          </div>
        </SlideBody>
      </SlideFrame>
    );
  }

  return (
    <SlideFrame label="Quiz">
      <SlideBody>
        <Eyebrow tone="sun" icon="star">
          Quiz · Show what you know
        </Eyebrow>
        <Heading>{q.heading}</Heading>
        <Lead>
          Tap one answer for each. Your score shows at the end — {pass}% to pass.
        </Lead>

        <ol className="flex flex-col gap-3">
          {q.items.map((item, i) => {
            // Short choices ("Compound" / "Not") sit beside the prompt as in the
            // reference deck. Sentence-length choices stack under it instead.
            const compact = item.choices.every((c) => c.length <= 16);
            return (
              <li key={i}>
                <fieldset
                  className={`flex flex-col gap-3 rounded-[22px] border-2 border-slide-line bg-[#FBFAFE] px-[clamp(0.9rem,1.7cqw,1.4rem)] py-3.5 ${
                    compact ? '@2xl:flex-row @2xl:items-center @2xl:gap-4' : ''
                  }`}
                >
                  <legend className="sr-only">
                    Question {i + 1}: {item.prompt}
                  </legend>
                  <div className="flex min-w-0 flex-1 items-start gap-4 @2xl:items-center">
                    <span
                      aria-hidden="true"
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-slide-line font-slide-display text-base font-bold text-slide-ink-soft"
                    >
                      {i + 1}
                    </span>
                    <p
                      aria-hidden="true"
                      className="min-w-0 flex-1 font-slide-display text-[clamp(1.0625rem,1.8cqw,1.4375rem)] font-bold leading-snug text-slide-ink"
                    >
                      {item.prompt}
                    </p>
                  </div>
                  <div className={compact ? 'flex flex-wrap gap-2.5' : 'flex flex-col gap-2 pl-[50px]'}>
                    {item.choices.map((choice, c) => {
                      const on = answers[i] === c;
                      return (
                        <label
                          key={c}
                          className={`slide-motion cursor-pointer border-2 font-slide-display text-lg font-bold transition has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-slide-teal-strong ${
                            compact ? 'rounded-full px-[1.3em] py-2' : 'rounded-2xl px-4 py-2.5 text-left'
                          } ${
                            on
                              ? `border-[3px] ${CHOICE_TONES[compact ? c % CHOICE_TONES.length : 0]}`
                              : 'border-slide-line bg-paper text-slide-ink-soft hover:border-slide-ink-soft'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`quiz-${i}`}
                            className="sr-only"
                            checked={on}
                            onChange={() => dispatch({ type: 'answer', item: i, choice: c })}
                          />
                          {choice}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <ActionButton
            tone="pink"
            disabled={answered < q.items.length}
            onClick={() => dispatch({ type: 'submit' })}
          >
            Check my answers
          </ActionButton>
          <p className="inline-flex items-center gap-2.5 rounded-full bg-[#F1F0FA] px-4 py-2.5 font-slide-body text-base font-bold text-slide-ink-soft">
            <Icon name="lock" className="h-[18px] w-[18px]" strokeWidth={2.4} />
            {answered < q.items.length
              ? `Results stay hidden until you finish all the questions (${answered} of ${q.items.length}).`
              : 'All answered. Check your answers to see how you did.'}
          </p>
        </div>
      </SlideBody>
    </SlideFrame>
  );
}

/* ------------------------------- 8 · recap ------------------------------- */

export function RecapSlide({ lesson, state }: Pick<SlideProps, 'lesson' | 'state'>) {
  const r = lesson.recap;
  const score = scoreQuiz(state.quiz.answers, lesson.quiz.items);
  const quizTaken = state.quiz.submitted;
  return (
    <SlideFrame tone="sky" label="Recap">
      <div className="relative flex flex-1 flex-col @3xl:flex-row">
        <div className="slide-pad-x slide-pad-y flex flex-1 flex-col justify-center gap-[clamp(0.75rem,1.7cqw,1.4rem)] @3xl:w-[62%] @3xl:flex-none">
          <Eyebrow tone="glass" icon="star">
            You did it!
          </Eyebrow>
          <Heading tone="paper">{r.heading}</Heading>
          <ul className="flex flex-col gap-[clamp(0.6rem,1.4cqw,1.1rem)] pt-1">
            {[...r.takeaways.map((text) => ({ text, icon: 'check' as const })), { text: r.watchOut, icon: 'bang' as const }].map(
              (row, i) => (
                <li key={i} className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slide-sun text-slide-ink"
                  >
                    <Icon name={row.icon} className="h-6 w-6" strokeWidth={3.4} />
                  </span>
                  <span className="slide-lead font-slide-body font-extrabold text-paper">
                    {row.icon === 'bang' && <span className="sr-only">Watch out: </span>}
                    {row.text}
                  </span>
                </li>
              ),
            )}
          </ul>
          {quizTaken && (
            <p className="slide-small font-slide-body font-bold text-paper">
              Your quiz: {score.correct} of {score.total} correct
              {score.passed ? ' — passed.' : '. Go back to the quiz to try again.'}
            </p>
          )}
        </div>
        <div className="relative flex items-center justify-center px-[8%] pb-[5%] @3xl:flex-1 @3xl:px-0 @3xl:pb-0">
          <MascotArt
            halo={false}
            words={lesson.keyTerms.join('  ')}
            className="w-[min(62cqw,15rem)] @3xl:w-[66%]"
          />
        </div>
      </div>
    </SlideFrame>
  );
}
