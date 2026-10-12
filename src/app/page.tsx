import { QuestionInput } from '@/components/QuestionInput';

export default function HomePage() {
  return (
    <div className="space-y-11">
      <section className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
        <div className="max-w-[760px] space-y-5">
          <p className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.08em]">
            <span className="h-1 w-10 border border-foreground bg-signal" />
            AI lesson generator
          </p>
          <h1 className="text-[42px] font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-[52px] sm:leading-[56px]">
            Turn one question into a lesson that teaches the answer.
          </h1>
          <p className="max-w-[640px] text-[17px] leading-7 text-muted">
            Paste a question or upload a screenshot. The pipeline identifies the
            subject and TEKS level first, then writes a focused, grade-aware lesson.
          </p>
        </div>

        <aside className="w-full rounded-xl border-2 border-foreground bg-signal p-5 lg:w-[270px]">
          <p className="text-xs font-bold uppercase tracking-[0.08em]">
            Two focused passes
          </p>
          <p className="mt-5 text-3xl font-extrabold leading-8 tracking-[-0.03em]">
            Classify.<br />Then teach.
          </p>
          <p className="mt-5 text-sm font-medium leading-5">
            Clearer inputs. Auditable outputs. Better lessons.
          </p>
        </aside>
      </section>

      <QuestionInput />

      <ol className="grid border-t-2 border-foreground pt-5 text-sm sm:grid-cols-3">
        <PipelineStep n="01" title="Capture">
          Text or screenshot enters one validated submission.
        </PipelineStep>
        <PipelineStep n="02" title="Classify">
          The model anchors grade, subject, and standard to TEKS.
        </PipelineStep>
        <PipelineStep n="03" title="Teach">
          A second pass builds the lesson at the known level.
        </PipelineStep>
      </ol>
    </div>
  );
}

function PipelineStep({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 border-border py-3 sm:border-l sm:px-7 sm:first:border-l-0 sm:first:pl-0">
      <span className="text-xs font-extrabold text-accent">{n}</span>
      <span>
        <strong className="block text-foreground">{title}</strong>
        <span className="mt-1 block leading-5 text-muted">{children}</span>
      </span>
    </li>
  );
}
