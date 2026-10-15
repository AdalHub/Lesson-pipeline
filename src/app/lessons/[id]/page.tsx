import { TRPCError } from '@trpc/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClassificationBadge, humanize } from '@/components/ClassificationBadge';
import { LessonDesignPanel } from '@/components/LessonDesignPanel';
import { LessonView } from '@/components/LessonView';
import { isSlideLesson } from '@/server/ai/schemas';
import { api } from '@/trpc/server';

export const dynamic = 'force-dynamic';

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

function ordinal(n: number) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
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
  const grounding = classification
    ? readGrounding(classification.rawResponse)
    : null;

  if (!classification || !lesson) {
    return (
      <div className="space-y-7">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">
            Saved submission
          </p>
          <h1 className="text-4xl font-extrabold tracking-[-0.04em]">
            Pipeline result
          </h1>
        </div>
        <OriginalQuestion submission={submission} />
        {classification ? (
          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <ClassificationBadge
              gradeLevel={classification.gradeLevel}
              gradeLevelConfidence={classification.gradeLevelConfidence}
              subject={classification.subject}
              teksStandard={classification.teksStandard}
              difficulty={classification.difficulty}
              questionType={classification.questionType}
            />
            <p className="text-sm text-muted">{classification.teksDescription}</p>
            <GroundingEvidence grounding={grounding} />
          </section>
        ) : (
          <Notice title="No classification">
            The classification call failed for this submission, so nothing further was generated.
          </Notice>
        )}
        {classification && !lesson && (
          <Notice title="No lesson">
            Classification succeeded, but lesson generation failed. The classification was kept.
          </Notice>
        )}
        <FooterLinks />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[18px] border-2 border-foreground bg-card lg:flex">
        <div className="flex-1 space-y-4 p-7 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">
            Generated lesson · Ready
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] sm:text-[42px]">
            {lesson.content.title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted">
            {lesson.content.objective}
          </p>
        </div>
        <aside className="flex w-full flex-col justify-between gap-6 border-t-2 border-foreground bg-signal p-7 lg:w-[310px] lg:border-l-2 lg:border-t-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em]">Classification</p>
          <div className="space-y-3">
            <p className="text-3xl font-extrabold tracking-[-0.03em]">
              {ordinal(classification.gradeLevel)} grade
            </p>
            <p className="text-xs font-semibold">
              Estimated alignment · {classification.gradeLevelConfidence} confidence
            </p>
            {classification.teksStandard === 'unknown' && (
              <p className="text-sm">No defensible match in the current TEKS catalog. Review this estimate.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-foreground bg-card px-3 py-1.5 text-xs font-bold">
                {SUBJECT_LABELS[classification.subject] ?? humanize(classification.subject)}
              </span>
              <span className="rounded-full border border-foreground bg-card px-3 py-1.5 font-mono text-xs font-bold">
                TEKS {classification.teksStandard}
              </span>
            </div>
          </div>
        </aside>
      </section>

      <div className="flex flex-col items-start gap-7 lg:flex-row">
        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-5 lg:w-[270px]">
          {isSlideLesson(lesson.content) ? (
            <LessonDesignPanel lesson={lesson.content} />
          ) : (
            <nav className="rounded-xl border border-border bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em]">Lesson map</p>
              <div className="mt-4 space-y-3 text-sm">
                <a href="#concept" className="block border-l-4 border-accent pl-3 font-bold">Concept</a>
                <a href="#worked-example" className="block pl-4 text-muted hover:text-foreground">Worked example</a>
                <a href="#common-mistakes" className="block pl-4 text-muted hover:text-foreground">Common mistakes</a>
                <a href="#practice" className="block pl-4 text-muted hover:text-foreground">Practice</a>
              </div>
            </nav>
          )}

          <OriginalQuestion submission={submission} dark />

          <details className="rounded-xl border border-border bg-card p-5 text-sm">
            <summary className="cursor-pointer select-none font-bold">Why this classification?</summary>
            <div className="mt-3 space-y-2 leading-6 text-muted">
              <p>{classification.reasoning}</p>
              <p><span className="font-semibold text-foreground">TEKS: </span>{classification.teksDescription}</p>
              <p><span className="font-semibold text-foreground">Concepts: </span>{classification.keyConcepts.join(', ')}</p>
              <GroundingEvidence grounding={grounding} />
            </div>
          </details>
        </aside>

        <LessonView lesson={lesson.content} gradeLevel={classification.gradeLevel} />
      </div>

      <div className="flex flex-col justify-between gap-3 border-t border-border pt-5 text-xs text-muted sm:flex-row">
        <p>
          Submitted {formatDate(submission.createdAt)} · {classification.model} in {classification.latencyMs} ms · {lesson.model} in {lesson.latencyMs} ms
        </p>
        <FooterLinks />
      </div>
    </div>
  );
}

type Grounding = {
  selectedCandidateKey: string | null;
  webSources: Array<{ url: string; title: string | null }>;
  selectedSourceUrl: string | null;
  candidateCount: number;
};

function readGrounding(value: unknown): Grounding | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.groundingVersion !== 1) return null;

  const selectedCandidateKey =
    typeof raw.selectedCandidateKey === 'string' ? raw.selectedCandidateKey : null;
  const candidates = Array.isArray(raw.retrievedCandidates)
    ? (raw.retrievedCandidates as Array<Record<string, unknown>>)
    : [];
  const selected = candidates.find(
    (candidate) => candidate.key === selectedCandidateKey,
  );
  const webResearch =
    raw.webResearch && typeof raw.webResearch === 'object'
      ? (raw.webResearch as Record<string, unknown>)
      : null;
  const sources = Array.isArray(webResearch?.sources)
    ? (webResearch.sources as Array<Record<string, unknown>>)
        .filter(
          (source) =>
            typeof source.url === 'string' &&
            /^https:\/\/(?:[^/]+\.)?(?:tea\.texas\.gov|texreg\.sos\.state\.tx\.us)(?:\/|$)/i.test(
              source.url,
            ),
        )
        .map((source) => ({
          url: source.url as string,
          title: typeof source.title === 'string' ? source.title : null,
        }))
    : [];

  return {
    selectedCandidateKey,
    webSources: sources,
    selectedSourceUrl:
      typeof selected?.sourceUrl === 'string' ? selected.sourceUrl : null,
    candidateCount: candidates.length,
  };
}

function GroundingEvidence({ grounding }: { grounding: Grounding | null }) {
  if (!grounding) return null;

  const links = [
    ...(grounding.selectedSourceUrl
      ? [{ url: grounding.selectedSourceUrl, title: 'Selected TEKS record' }]
      : []),
    ...grounding.webSources,
  ].filter(
    (source, index, all) =>
      all.findIndex((candidate) => candidate.url === source.url) === index,
  );

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="font-semibold text-foreground">
        Grounded classification
      </p>
      <p>
        Retrieved {grounding.candidateCount} database candidates.
        {grounding.selectedSourceUrl ? ' The model selected a verified record.' : ' No verified record was selected.'}
        {grounding.webSources.length ? ' Official web evidence was also consulted.' : ''}
      </p>
      {links.length > 0 && (
        <p>
          Sources:{' '}
          {links.map((source, index) => (
            <span key={source.url}>
              {index > 0 && ', '}
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent underline underline-offset-2"
              >
                {source.title || new URL(source.url).hostname}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function OriginalQuestion({
  submission,
  dark = false,
}: {
  submission: Awaited<ReturnType<typeof api.lesson.getById>>['submission'];
  dark?: boolean;
}) {
  return (
    <section className={`rounded-xl p-5 ${dark ? 'bg-foreground text-card' : 'border border-border bg-card'}`}>
      <p className={`text-xs font-bold uppercase tracking-[0.08em] ${dark ? 'text-signal' : 'text-accent'}`}>
        Original question
      </p>
      {submission.inputType === 'image' && submission.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={submission.imageUrl}
          alt="Submitted question screenshot"
          className="mt-3 max-h-72 w-auto rounded-lg bg-white object-contain"
        />
      ) : (
        <blockquote className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {submission.rawText}
        </blockquote>
      )}
    </section>
  );
}

function FooterLinks() {
  return (
    <p className="shrink-0 text-sm font-semibold">
      <Link href="/" className="text-accent hover:underline">← New question</Link>
      <span className="mx-2 text-muted">·</span>
      <Link href="/lessons" className="text-accent hover:underline">History</Link>
    </p>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-danger/40 bg-danger-soft px-5 py-4 text-sm">
      <p className="font-bold text-danger">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}
