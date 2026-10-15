import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { LegacyLesson } from '@/server/ai/schemas';

/** Renders lessons stored before the slide deck existed. */
export function LegacyLessonView({ lesson }: { lesson: LegacyLesson }) {
  return (
    <article className="min-w-0 flex-1 space-y-5">
      <section
        id="concept"
        className="space-y-4 rounded-xl border border-border bg-card p-6 sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-extrabold text-white">
            01
          </span>
          <h2 className="text-2xl font-extrabold tracking-[-0.025em]">How it works</h2>
        </div>
        <div className="prose max-w-none prose-headings:tracking-tight prose-p:my-2 prose-p:leading-7 prose-li:my-1 prose-strong:text-foreground">
          <Markdown remarkPlugins={[remarkGfm]}>{lesson.explanation}</Markdown>
        </div>
        {lesson.prerequisites.length > 0 && (
          <div className="border-l-4 border-signal bg-background px-5 py-4 text-sm leading-6">
            <span className="font-bold">Before you start: </span>
            {lesson.prerequisites.join(' · ')}
          </div>
        )}
      </section>

      <section
        id="worked-example"
        className="space-y-5 rounded-xl bg-foreground p-6 text-card sm:p-8"
      >
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-signal">Worked example</p>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight">
              {lesson.workedExample.problem}
            </h2>
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-signal">
            Follow the reasoning
          </span>
        </div>
        <ol className="grid gap-2 md:grid-cols-2">
          {lesson.workedExample.steps.map((step, index) => (
            <li key={index} className="rounded-lg border border-white/20 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-extrabold">
                  {index + 1}
                </span>
                <div className="space-y-1">
                  <p className="font-bold">{step.step}</p>
                  <p className="text-sm leading-6 text-white/70">{step.explanation}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-lg bg-signal px-5 py-4 text-foreground">
          <p className="text-xs font-bold uppercase tracking-[0.08em]">Answer</p>
          <p className="mt-1 text-xl font-extrabold">{lesson.workedExample.answer}</p>
        </div>
      </section>

      <section
        id="common-mistakes"
        className="rounded-xl border border-border bg-card p-6 sm:p-7"
      >
        <h2 className="text-xl font-extrabold tracking-tight">Common mistakes</h2>
        <ul className="mt-4 divide-y divide-border">
          {lesson.commonMistakes.map((mistake, index) => (
            <li key={index} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <span className="w-7 shrink-0 text-xs font-extrabold text-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="space-y-1.5">
                <p className="font-bold">{mistake.mistake}</p>
                <p className="text-sm leading-6 text-muted">
                  <span className="font-semibold text-foreground">Why: </span>
                  {mistake.whyItHappens}
                </p>
                <p className="text-sm leading-6 text-muted">
                  <span className="font-semibold text-foreground">Avoid it: </span>
                  {mistake.howToAvoid}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="practice" className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-extrabold tracking-tight">Practice</h2>
          <p className="text-xs font-semibold text-success">Answers stay hidden</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {lesson.practiceProblems.map((problem, index) => (
            <li key={index} className="rounded-xl border border-border bg-card p-5">
              <p className="font-semibold leading-6">
                <span className="mr-2 text-accent">{index + 1}.</span>
                {problem.problem}
              </p>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer select-none font-semibold text-muted hover:text-foreground">Show hint</summary>
                <p className="mt-2 border-l-2 border-signal pl-3 leading-6">{problem.hint}</p>
              </details>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer select-none font-semibold text-muted hover:text-foreground">Reveal answer</summary>
                <p className="mt-2 rounded-md bg-success-soft px-3 py-2 font-semibold text-success">
                  {problem.answer}
                </p>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
