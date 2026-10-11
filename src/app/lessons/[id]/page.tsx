import { TRPCError } from '@trpc/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClassificationBadge } from '@/components/ClassificationBadge';
import { LessonView } from '@/components/LessonView';
import { api } from '@/trpc/server';

export const dynamic = 'force-dynamic';

function formatDate(d: Date) {
  return d.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof api.lesson.getById>>;
  try {
    data = await api.lesson.getById({ id });
  } catch (err) {
    if (
      err instanceof TRPCError &&
      (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST')
    ) {
      notFound();
    }
    throw err;
  }

  const { submission, classification, lesson } = data;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted">
          Submitted {formatDate(submission.createdAt)}
        </p>
        {submission.inputType === 'image' && submission.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={submission.imageUrl}
            alt="Submitted question screenshot"
            className="max-h-96 w-auto rounded-xl border border-border"
          />
        ) : (
          <blockquote className="whitespace-pre-wrap rounded-xl border border-border bg-card p-4 font-mono text-sm">
            {submission.rawText}
          </blockquote>
        )}
      </section>

      {classification ? (
        <section className="space-y-3">
          <ClassificationBadge
            gradeLevel={classification.gradeLevel}
            gradeLevelConfidence={classification.gradeLevelConfidence}
            subject={classification.subject}
            teksStandard={classification.teksStandard}
            difficulty={classification.difficulty}
            questionType={classification.questionType}
          />
          <p className="text-sm text-muted">{classification.teksDescription}</p>
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-muted hover:text-foreground">
              Why this classification?
            </summary>
            <div className="mt-2 space-y-2 rounded-xl border border-border bg-card p-4">
              <p>{classification.reasoning}</p>
              <p className="text-muted">
                Key concepts: {classification.keyConcepts.join(', ')}
              </p>
              <p className="font-mono text-xs text-muted">
                {classification.model} · {classification.latencyMs} ms
              </p>
            </div>
          </details>
        </section>
      ) : (
        <Notice title="No classification">
          The classification call failed for this submission, so nothing
          further was generated.
        </Notice>
      )}

      {lesson ? (
        <>
          <hr className="border-border" />
          <LessonView lesson={lesson.content} />
          <p className="font-mono text-xs text-muted">
            Lesson by {lesson.model} in {lesson.latencyMs} ms
          </p>
        </>
      ) : classification ? (
        <Notice title="No lesson">
          The classification succeeded but lesson generation failed. The
          classification above was kept.
        </Notice>
      ) : null}

      <p className="text-sm">
        <Link href="/" className="text-accent hover:underline">
          ← New question
        </Link>
        <span className="mx-2 text-muted">·</span>
        <Link href="/lessons" className="text-accent hover:underline">
          History
        </Link>
      </p>
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm">
      <p className="font-semibold text-danger">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}
