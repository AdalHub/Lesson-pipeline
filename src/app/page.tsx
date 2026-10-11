import { QuestionInput } from '@/components/QuestionInput';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Turn a test question into a lesson
        </h1>
        <p className="text-muted">
          Paste a question or a screenshot. It is classified against the Texas
          Essential Knowledge and Skills (TEKS), then a lesson is written for
          that grade level: objective, explanation, worked example, common
          mistakes and practice problems.
        </p>
      </div>

      <QuestionInput />

      <ol className="grid gap-3 text-sm text-muted sm:grid-cols-2">
        <li className="rounded-xl border border-border bg-card/60 p-4">
          <span className="font-semibold text-foreground">1. Classify.</span>{' '}
          Grade level, subject, TEKS standard, question type and key concepts,
          anchored to the published standard rather than a general impression.
        </li>
        <li className="rounded-xl border border-border bg-card/60 p-4">
          <span className="font-semibold text-foreground">2. Generate.</span>{' '}
          A second call receives that classification and writes the lesson at
          the right reading level, teaching the method rather than the answer.
        </li>
      </ol>
    </div>
  );
}
