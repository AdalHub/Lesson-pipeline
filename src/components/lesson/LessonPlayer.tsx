'use client';

import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import type { Lesson } from '@/server/ai/schemas';
import { DECK_STEPS, initialDeckState, makeDeckReducer } from '@/lib/lesson-deck';
import { fredoka, nunito } from './fonts';
import { Icon } from './parts';
import {
  BigIdeaSlide,
  PracticeSlide,
  QuizSlide,
  RecapSlide,
  StrategySlide,
  TeachSlide,
  TitleSlide,
} from './slides';

const LAST = DECK_STEPS.length - 1;

/**
 * The student-facing lesson: seven screens (the reference deck's eight steps,
 * with the practice question and its answered state sharing a screen), driven
 * by one reducer so interactive state survives moving back and forth.
 */
export function LessonPlayer({
  lesson,
  gradeLevel,
}: {
  lesson: Lesson;
  gradeLevel: number;
}) {
  const reducer = useMemo(() => makeDeckReducer(lesson), [lesson]);
  const [state, dispatch] = useReducer(reducer, lesson, initialDeckState);
  const [step, setStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const go = (next: number) => setStep(Math.min(LAST, Math.max(0, next)));

  // After a step change, move focus to the new slide's heading so keyboard and
  // screen-reader users land at the top of the new content. Skipped on mount.
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    rootRef.current
      ?.querySelector<HTMLElement>('[data-slide-heading]')
      ?.focus({ preventScroll: true });
  }, [step]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Arrow keys belong to radio groups; do not hijack them.
    if ((event.target as HTMLElement).closest('input, textarea, select')) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(step + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(step - 1);
    }
  };

  const current = DECK_STEPS[step]!;

  return (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      className={`${fredoka.variable} ${nunito.variable} min-w-0 flex-1 space-y-4`}
    >
      <p className="sr-only" aria-live="polite">
        Step {step + 1} of {DECK_STEPS.length}: {current.label}
      </p>

      {step === 0 && (
        <TitleSlide lesson={lesson} gradeLevel={gradeLevel} onStart={() => go(1)} />
      )}
      {step === 1 && <BigIdeaSlide lesson={lesson} state={state} dispatch={dispatch} />}
      {step === 2 && <TeachSlide lesson={lesson} state={state} dispatch={dispatch} />}
      {step === 3 && <StrategySlide lesson={lesson} state={state} dispatch={dispatch} />}
      {step === 4 && <PracticeSlide lesson={lesson} state={state} dispatch={dispatch} />}
      {step === 5 && (
        <QuizSlide
          lesson={lesson}
          state={state}
          dispatch={dispatch}
          onContinue={() => go(6)}
        />
      )}
      {step === 6 && <RecapSlide lesson={lesson} state={state} />}

      <nav
        aria-label="Lesson steps"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 font-slide-body"
      >
        <button
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          className="inline-flex items-center gap-2.5 rounded-full border-2 border-slide-line bg-paper px-5 py-2.5 font-slide-display text-lg font-bold text-slide-ink outline-offset-4 transition hover:border-slide-ink-soft focus-visible:outline-[3px] focus-visible:outline-slide-teal-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="arrowLeft" className="h-5 w-5" strokeWidth={2.8} />
          Back
        </button>

        <div className="order-last flex w-full flex-col items-center gap-2 sm:order-none sm:w-auto">
          <ol className="flex items-center gap-2">
            {DECK_STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Step ${i + 1} of ${DECK_STEPS.length}: ${s.label}`}
                  aria-current={i === step ? 'step' : undefined}
                  className={`slide-motion block h-3 rounded-full outline-offset-4 transition-all focus-visible:outline-[3px] focus-visible:outline-slide-teal-strong ${
                    i === step
                      ? 'w-10 bg-slide-pink-fill'
                      : i < step
                        ? 'w-3 bg-slide-teal-strong'
                        : 'w-3 bg-slide-line hover:bg-slide-ink-soft'
                  }`}
                />
              </li>
            ))}
          </ol>
          <p className="text-[0.8125rem] font-extrabold uppercase tracking-label text-slide-ink-soft">
            Step {step + 1} of {DECK_STEPS.length} · {current.label}
          </p>
        </div>

        {step === LAST ? (
          <button
            type="button"
            onClick={() => go(0)}
            className="inline-flex items-center gap-2.5 rounded-full border-2 border-slide-teal-strong bg-paper px-5 py-2.5 font-slide-display text-lg font-bold text-slide-teal-strong outline-offset-4 transition hover:bg-slide-teal-wash focus-visible:outline-[3px] focus-visible:outline-slide-teal-strong"
          >
            <Icon name="refresh" className="h-5 w-5" strokeWidth={2.8} />
            Start over
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(step + 1)}
            className="inline-flex items-center gap-2.5 rounded-full bg-slide-teal-strong px-5 py-2.5 font-slide-display text-lg font-bold text-paper outline-offset-4 transition hover:brightness-110 focus-visible:outline-[3px] focus-visible:outline-slide-teal-strong"
          >
            Next
            <Icon name="arrowRight" className="h-5 w-5" strokeWidth={2.8} />
          </button>
        )}
      </nav>
    </div>
  );
}
