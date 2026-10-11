import Link from 'next/link';
import { ClassificationBadge } from '@/components/ClassificationBadge';
import { api } from '@/trpc/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(d: Date) {
  return d.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;
  const { items, nextCursor } = await api.lesson.list({
    limit: 20,
    cursor: cursor && UUID.test(cursor) ? cursor : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted">Past submissions, newest first.</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted">
          Nothing yet.{' '}
          <Link href="/" className="text-accent hover:underline">
            Generate your first lesson
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/lessons/${item.id}`}
                className="block space-y-2 p-4 transition hover:bg-accent-soft/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium">
                    {item.lesson?.title ?? (
                      <span className="text-danger">Lesson not generated</span>
                    )}
                  </p>
                  <time className="shrink-0 text-xs text-muted">
                    {formatDate(item.createdAt)}
                  </time>
                </div>
                <p className="line-clamp-2 text-sm text-muted">{item.preview}</p>
                {item.classification ? (
                  <ClassificationBadge
                    compact
                    gradeLevel={item.classification.gradeLevel}
                    gradeLevelConfidence={item.classification.gradeLevelConfidence}
                    subject={item.classification.subject}
                    teksStandard={item.classification.teksStandard}
                  />
                ) : (
                  <p className="text-xs text-danger">Classification failed</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <p className="text-sm">
          <Link
            href={`/lessons?cursor=${nextCursor}`}
            className="text-accent hover:underline"
          >
            Older →
          </Link>
        </p>
      )}
    </div>
  );
}
