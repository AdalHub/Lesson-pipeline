import type { Lesson } from '@/server/ai/schemas';
import { DECK_STEPS } from '@/lib/lesson-deck';

/**
 * Teacher-facing view of the plan the lesson was written from, and why the
 * slides are in the order they are. Collapsed by default so the student
 * view stays clean.
 */
export function LessonDesignPanel({ lesson }: { lesson: Lesson }) {
  const { plan } = lesson;
  return (
    <details className="rounded-xl border border-border bg-card p-5 text-sm">
      <summary className="cursor-pointer select-none font-bold">Lesson design (teacher view)</summary>
      <div className="mt-4 space-y-4 leading-6">
        <Field label="Learning goal">{plan.learningGoal}</Field>
        <Field label="Builds on">{plan.priorKnowledge}</Field>
        <div className="border-l-4 border-signal bg-background px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            Misconception targeted
          </p>
          <p className="mt-1 text-foreground">{plan.coreMisconception}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
            Success criteria
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {plan.successCriteria.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Why this order</p>
          <ol className="mt-3 space-y-3">
            {DECK_STEPS.map((step) => (
              <li key={step.id} className="flex gap-3">
                <span className="w-9 shrink-0 text-xs font-extrabold leading-6 text-accent">
                  {step.reference.split(' ')[0]}
                </span>
                <span>
                  <span className="block font-bold text-foreground">{step.principle}</span>
                  <span className="block text-muted">{step.why}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 text-foreground">{children}</p>
    </div>
  );
}
