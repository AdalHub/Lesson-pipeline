import Link from 'next/link';
import { humanize } from '@/components/ClassificationBadge';
import { MascotFace } from '@/components/Mascot';
import { api } from '@/trpc/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Mathematics',
  reading_language_arts: 'Reading / Language Arts',
  science: 'Science',
  social_studies: 'Social Studies',
  other: 'Other',
};

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
    <div className="space-y-8">
      <section className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">Saved work</p>
          <h1 className="text-[44px] font-extrabold leading-none tracking-[-0.04em] sm:text-[52px]">
            Lesson history
          </h1>
          <p className="text-[17px] leading-7 text-muted">
            Revisit every question, classification, and generated lesson.
          </p>
        </div>
        <div className="flex min-w-[250px] items-center justify-between border-t-4 border-signal bg-card px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em]">On this page</p>
            <p className="mt-1 text-xs text-muted">Newest lessons first</p>
          </div>
          <p className="text-4xl font-extrabold tracking-[-0.04em]">{items.length}</p>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-foreground bg-card p-10 text-center">
          <MascotFace className="mx-auto mb-4 h-16 w-16" />
          <p className="text-sm text-muted">Nothing yet.</p>
          <Link href="/" className="mt-3 inline-block font-bold text-accent hover:underline">
            Generate your first lesson →
          </Link>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border-2 border-foreground bg-card">
          <div className="hidden min-h-12 grid-cols-[72px_180px_1fr_145px_28px] items-center gap-5 bg-foreground px-5 text-xs font-bold uppercase tracking-[0.08em] text-card lg:grid">
            <span>Grade</span>
            <span>Subject + standard</span>
            <span>Question</span>
            <span>Created</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {items.map((item, index) => (
              <li key={item.id} className={index === 0 ? 'bg-signal-soft/30' : 'bg-card'}>
                <Link
                  href={`/lessons/${item.id}`}
                  className="grid min-h-[104px] gap-4 p-5 transition-colors hover:bg-accent-soft/40 lg:grid-cols-[72px_180px_1fr_145px_28px] lg:items-center lg:gap-5"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 border-foreground text-sm font-extrabold ${index === 0 ? 'bg-signal-soft' : 'bg-background'}`}>
                    {item.classification
                      ? String(item.classification.gradeLevel).padStart(2, '0')
                      : '—'}
                  </span>
                  <span className="space-y-1">
                    {item.classification ? (
                      <>
                        <span className="block text-sm font-bold">
                          {SUBJECT_LABELS[item.classification.subject] ?? humanize(item.classification.subject)}
                        </span>
                        <span className="block text-xs font-semibold text-accent">
                          TEKS {item.classification.teksStandard}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-danger">Classification failed</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-6">
                      {item.lesson?.title ?? 'Lesson not generated'}
                    </span>
                    <span className="mt-1 block line-clamp-1 text-sm text-muted lg:hidden">
                      {item.preview}
                    </span>
                  </span>
                  <time className="text-xs text-muted">{formatDate(item.createdAt)}</time>
                  <span className="text-xl font-semibold">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between text-xs text-muted">
        <p>Showing {items.length} recent {items.length === 1 ? 'lesson' : 'lessons'}</p>
        {nextCursor && (
          <Link
            href={`/lessons?cursor=${nextCursor}`}
            className="rounded-lg border border-foreground bg-card px-5 py-3 text-sm font-bold text-foreground hover:bg-signal-soft"
          >
            Load more
          </Link>
        )}
      </div>
    </div>
  );
}
