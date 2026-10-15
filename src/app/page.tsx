import { fredoka, nunito } from '@/components/lesson/fonts';
import { Icon, MascotArt, type IconName } from '@/components/lesson/parts';
import { QuestionInput } from '@/components/QuestionInput';
import { DECK_STEPS, type StepId } from '@/lib/lesson-deck';

/** Tile art for each lesson screen, using the deck's blue and pink. */
const STEP_TILES: Record<StepId, { icon: IconName; tile: string }> = {
  title: { icon: 'star', tile: 'bg-linear-to-r from-slide-sky-from to-slide-sky-to text-white' },
  bigIdea: { icon: 'pointer', tile: 'bg-accent-soft text-accent' },
  teach: { icon: 'list', tile: 'bg-accent-soft text-accent' },
  strategy: { icon: 'sliders', tile: 'bg-signal-soft text-signal' },
  practice: { icon: 'help', tile: 'bg-signal-soft text-signal' },
  quiz: { icon: 'lock', tile: 'bg-accent-soft text-accent' },
  recap: { icon: 'check', tile: 'bg-linear-to-r from-slide-sky-from to-slide-sky-to text-white' },
};

const FACTS = ['TEKS-aligned', 'Grade-aware', 'Practice and a quiz built in'];

export default function HomePage() {
  return (
    // Fredoka and Nunito are the deck's fonts; the variables are scoped to this page.
    <div className={`${fredoka.variable} ${nunito.variable} space-y-14`}>
      <div>
        <Hero />
        {/* The card overlaps the bottom of the hero to tie the two together. */}
        <div id="start" className="relative z-10 -mt-12 px-2 sm:px-6 lg:-mt-16 lg:px-10">
          <QuestionInput />
        </div>
      </div>

      <HowItWorks />
      <WhatStudentsGet />
    </div>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-clip rounded-[28px] bg-linear-to-b from-[#0a6a84] via-slide-sky-from via-58% to-[#1a9bb9] text-white shadow-[0_24px_48px_-28px_rgba(0,112,142,0.7)] lg:bg-linear-to-r lg:via-62% lg:to-slide-sky-to"
    >
      <div className="relative grid items-center gap-5 px-6 pb-24 pt-7 sm:gap-6 sm:px-10 sm:pt-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-4 lg:px-14 lg:pb-28 lg:pt-14">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-foreground/25 px-4 py-2 font-slide-body text-[0.8125rem] font-extrabold uppercase tracking-[0.08em]">
            <Icon name="star" filled className="h-4 w-4" strokeWidth={2} />
            AI lesson generator
          </p>

          <h1
            id="hero-heading"
            className="font-slide-display text-[clamp(2.1rem,4.6vw,3.6rem)] font-bold leading-[1.06] tracking-[-0.02em]"
          >
            Turn one question into a lesson that{' '}
            <span className="underline decoration-signal decoration-[6px] underline-offset-[7px]">
              teaches the answer.
            </span>
          </h1>

          <p className="max-w-[34rem] font-slide-body text-[1.0625rem] font-medium leading-7 text-white sm:text-lg">
            Paste a question or upload a screenshot. We find the TEKS standard first, then
            write a short interactive lesson at the right grade level.
          </p>

          <ul className="flex flex-wrap gap-2.5">
            {FACTS.map((fact) => (
              <li
                key={fact}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground/25 px-3 py-1.5 font-slide-body text-[0.8125rem] font-bold sm:gap-2 sm:px-3.5 sm:text-sm"
              >
                <Icon name="check" className="h-4 w-4" strokeWidth={3.2} />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative order-first mx-auto w-full max-w-[170px] sm:max-w-[250px] lg:order-none lg:max-w-[340px]">
          <MascotArt words="Got a question?" tone="page" float decorative className="w-full" />
        </div>
      </div>

      {/* Sparkles in the gaps between copy and mascot, as on the lesson title slide. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        <span className="absolute left-[60%] top-[15%] h-3 w-3 rounded-full bg-white/80" />
        <span className="absolute left-[57%] top-[60%] h-5 w-5 rounded-full bg-signal" />
        <span className="absolute left-[64%] top-[74%] h-7 w-7 rounded-full border-[5px] border-white/50" />
        <svg
          viewBox="0 0 120 28"
          className="absolute bottom-[30%] left-[49%] w-24"
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="6"
          strokeLinecap="round"
        >
          <path d="M4 14c10-14 20-14 28 0s18 14 28 0 18-14 28 0 18 14 28 0" />
        </svg>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="space-y-5">
      <h2
        id="how-heading"
        className="font-slide-display text-[1.75rem] font-bold tracking-[-0.02em]"
      >
        How it works
      </h2>
      <ol className="grid gap-4 md:grid-cols-3">
        <PipelineStep n={1} icon="image" tone="teal" title="Capture">
          Paste text or drop a screenshot. It is saved before any AI step runs.
        </PipelineStep>
        <PipelineStep n={2} icon="search" tone="pink" title="Classify">
          The question is matched to a real TEKS standard, so the grade is grounded, not guessed.
        </PipelineStep>
        <PipelineStep n={3} icon="cap" tone="teal" title="Teach">
          A short interactive lesson is written at that level, with practice and a quiz.
        </PipelineStep>
      </ol>
    </section>
  );
}

function PipelineStep({
  n,
  icon,
  tone,
  title,
  children,
}: {
  n: number;
  icon: IconName;
  tone: 'teal' | 'pink';
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border-2 border-border bg-card p-5">
      <span
        aria-hidden="true"
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          tone === 'teal' ? 'bg-accent-soft text-accent' : 'bg-signal-soft text-signal'
        }`}
      >
        <Icon name={icon} className="h-6 w-6" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-extrabold uppercase tracking-[0.08em] text-accent">
          Step {n}
        </span>
        <strong className="block font-slide-display text-xl font-bold leading-tight">
          {title}
        </strong>
        <span className="mt-1 block text-sm leading-6 text-muted">{children}</span>
      </span>
    </li>
  );
}

function WhatStudentsGet() {
  return (
    <section aria-labelledby="deck-heading" className="space-y-5">
      <div className="space-y-2">
        <h2
          id="deck-heading"
          className="font-slide-display text-[1.75rem] font-bold tracking-[-0.02em]"
        >
          What the student gets
        </h2>
        <p className="max-w-[40rem] text-base leading-7 text-muted">
          Every lesson is a short deck of seven screens, in the order that helps a skill
          stick: see it, try it, check it, then prove it.
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {DECK_STEPS.map((step, index) => {
          const art = STEP_TILES[step.id];
          return (
            <li
              key={step.id}
              className="flex flex-col gap-3 rounded-2xl border-2 border-border bg-card p-3.5"
            >
              <span
                aria-hidden="true"
                className={`flex h-14 items-center justify-center rounded-xl ${art.tile}`}
              >
                <Icon name={art.icon} className="h-6 w-6" strokeWidth={2.4} filled={art.icon === 'star'} />
              </span>
              <span>
                <span className="block text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-muted">
                  {index + 1}
                </span>
                <strong className="block font-slide-display text-lg font-bold leading-tight">
                  {step.label}
                </strong>
                <span className="mt-1 block text-[0.8125rem] leading-5 text-muted">
                  {step.principle}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
