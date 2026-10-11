import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Lesson } from '@/server/ai/schemas';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {children}
    </div>
  );
}

export function LessonView({ lesson }: { lesson: Lesson }) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
        <p className="rounded-xl border-l-4 border-accent bg-accent-soft/60 px-4 py-3 text-sm">
          <span className="font-semibold">Objective: </span>
          {lesson.objective}
        </p>
        {lesson.prerequisites.length > 0 && (
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">You should already know: </span>
            {lesson.prerequisites.join(' · ')}
          </p>
        )}
      </header>

      <Section title="How it works">
        <div className="prose prose-stone max-w-none dark:prose-invert prose-p:my-2 prose-li:my-0.5">
          <Markdown remarkPlugins={[remarkGfm]}>{lesson.explanation}</Markdown>
        </div>
      </Section>

      <Section title="Worked example">
        <Card>
          <p className="font-medium">{lesson.workedExample.problem}</p>
          <ol className="mt-4 space-y-3">
            {lesson.workedExample.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{s.step}</p>
                  <p className="text-sm text-muted">{s.explanation}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-border pt-3 text-sm">
            <span className="font-semibold">Answer: </span>
            {lesson.workedExample.answer}
          </p>
        </Card>
      </Section>

      <Section title="Common mistakes">
        <ul className="space-y-3">
          {lesson.commonMistakes.map((m, i) => (
            <li key={i}>
              <Card>
                <p className="font-medium text-danger">{m.mistake}</p>
                <p className="mt-1 text-sm">
                  <span className="text-muted">Why it happens: </span>
                  {m.whyItHappens}
                </p>
                <p className="mt-1 text-sm">
                  <span className="text-muted">How to avoid it: </span>
                  {m.howToAvoid}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Practice">
        <ol className="space-y-3">
          {lesson.practiceProblems.map((p, i) => (
            <li key={i}>
              <Card>
                <p className="font-medium">
                  {i + 1}. {p.problem}
                </p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer select-none text-muted hover:text-foreground">
                    Hint
                  </summary>
                  <p className="mt-1 pl-4">{p.hint}</p>
                </details>
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer select-none text-muted hover:text-foreground">
                    Show answer
                  </summary>
                  <p className="mt-1 pl-4 font-medium">{p.answer}</p>
                </details>
              </Card>
            </li>
          ))}
        </ol>
      </Section>
    </article>
  );
}
