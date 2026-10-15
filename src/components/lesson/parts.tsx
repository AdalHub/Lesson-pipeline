import { useId, type ReactNode } from 'react';
import type { Segment } from '@/server/ai/schemas';

/* -------------------------------- icons -------------------------------- */

const ICONS = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  star: <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />,
  pointer: (
    <>
      <path d="M22 14a8 8 0 0 1-8 8" />
      <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
      <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
      <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </>
  ),
  list: (
    <>
      <path d="M3 6h18" />
      <path d="M3 12h12" />
      <path d="M3 18h18" />
    </>
  ),
  sliders: (
    <>
      <path d="M21 4h-7" />
      <path d="M10 4H3" />
      <path d="M21 12h-9" />
      <path d="M8 12H3" />
      <path d="M21 20h-5" />
      <path d="M12 20H3" />
      <path d="M14 2v4" />
      <path d="M8 10v4" />
      <path d="M16 18v4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  bang: (
    <>
      <path d="M12 7v6" />
      <path d="M12 17h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  cap: (
    <>
      <path d="M21.4 10.9a1 1 0 0 0 0-1.8L12.8 5.2a2 2 0 0 0-1.6 0L2.6 9.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </>
  ),
  shield: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 2.5,
  filled = false,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {ICONS[name]}
    </svg>
  );
}

/* ------------------------------ type & frame ----------------------------- */

const EYEBROW_TONES = {
  teal: 'bg-slide-teal-soft text-slide-teal-strong',
  pink: 'bg-slide-pink-soft text-slide-pink-strong',
  sun: 'bg-slide-sun-soft text-slide-sun-strong',
  glass: 'bg-slide-ink/25 text-paper',
} as const;

export function Eyebrow({
  tone = 'teal',
  icon,
  children,
}: {
  tone?: keyof typeof EYEBROW_TONES;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <p
      className={`slide-eyebrow inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-[1.2em] py-[0.65em] font-slide-body font-extrabold uppercase ${EYEBROW_TONES[tone]}`}
    >
      {icon && <Icon name={icon} className="h-[1.2em] w-[1.2em]" filled={icon === 'star'} />}
      {children}
    </p>
  );
}

/** The one heading of a slide. The player moves focus here on step change. */
export function Heading({
  children,
  tone = 'ink',
}: {
  children: ReactNode;
  tone?: 'ink' | 'paper';
}) {
  return (
    <h2
      data-slide-heading
      tabIndex={-1}
      className={`slide-h1 font-slide-display font-bold tracking-[-0.02em] outline-none ${
        tone === 'paper' ? 'text-paper' : 'text-slide-ink'
      }`}
    >
      {children}
    </h2>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="slide-lead font-slide-body font-medium text-slide-ink-soft">{children}</p>
  );
}

/**
 * 16:9 frame that scales its type with its own width (container queries).
 * Content may grow the frame taller than 16:9. This needs overflow-clip, not
 * overflow-hidden: hidden makes the box a scroll container, which turns its
 * content-based minimum height into zero and clips whatever does not fit.
 * For the same reason there is no explicit min-height here.
 */
export function SlideFrame({
  tone = 'light',
  label,
  children,
}: {
  tone?: 'light' | 'sky';
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={`slide-enter @container relative flex aspect-video w-full flex-col overflow-clip rounded-slide-lg border-2 ${
        tone === 'sky'
          ? 'border-transparent bg-linear-to-r from-slide-sky-from to-slide-sky-to text-paper'
          : 'border-slide-line bg-paper text-slide-ink'
      }`}
    >
      {children}
    </section>
  );
}

/** Padded, top-aligned column used by every light slide. */
export function SlideBody({ children }: { children: ReactNode }) {
  return (
    <div className="slide-pad-x slide-pad-y flex flex-1 flex-col gap-[clamp(0.75rem,1.56cqw,1.25rem)]">
      {children}
    </div>
  );
}

/* ------------------------- signalled sentence parts ---------------------- */

type KeyStyle = 'outline' | 'filled';

function Seg({ text, role, keyStyle }: Segment & { keyStyle: KeyStyle }) {
  switch (role) {
    case 'key':
      return keyStyle === 'filled' ? (
        <span className="rounded-full bg-slide-teal-strong px-[0.6em] text-paper">{text}</span>
      ) : (
        <span className="rounded-full border-[3px] border-slide-teal-strong px-[0.5em] text-slide-teal-strong">
          {text}
        </span>
      );
    case 'mark':
      return (
        <span className="rounded-[0.4em] bg-slide-sun-soft px-[0.28em] text-slide-ink">{text}</span>
      );
    case 'focus':
      return (
        <span className="rounded-[0.45em] bg-slide-pink-soft px-[0.4em] text-slide-pink-strong">
          {text}
        </span>
      );
    default:
      return <span className="text-slide-ink">{text}</span>;
  }
}

/**
 * A sentence whose important parts are signalled the same way on every slide
 * (dual coding): key = teal pill, mark = sun highlight, focus = pink block.
 */
export function Segments({
  items,
  size = 'lg',
  keyStyle = 'outline',
}: {
  items: Segment[];
  size?: 'md' | 'lg';
  keyStyle?: KeyStyle;
}) {
  return (
    <p
      className={`flex flex-wrap items-center justify-center gap-x-[0.3em] gap-y-[0.25em] text-center font-slide-display font-bold ${
        size === 'lg' ? 'slide-sentence' : 'slide-card'
      }`}
    >
      {items.map((segment, i) => (
        <Seg key={i} {...segment} keyStyle={keyStyle} />
      ))}
    </p>
  );
}

export function Chip({
  kind,
  children,
}: {
  kind: 'ok' | 'bad' | 'idle';
  children: ReactNode;
}) {
  const tone = {
    ok: 'bg-slide-teal-soft text-slide-teal-strong',
    bad: 'bg-slide-pink-soft text-slide-pink-strong',
    idle: 'bg-slide-line text-slide-ink-soft',
  }[kind];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 font-slide-body text-[0.9375rem] font-extrabold leading-5 ${tone}`}
    >
      {kind === 'ok' && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3.4} />}
      {kind === 'bad' && <Icon name="x" className="h-3.5 w-3.5" strokeWidth={3.4} />}
      {children}
    </span>
  );
}

export function ActionButton({
  tone = 'pink',
  icon,
  onClick,
  disabled,
  children,
}: {
  tone?: 'pink' | 'teal' | 'ink';
  icon?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const bg = {
    pink: 'bg-slide-pink-fill hover:brightness-95',
    teal: 'bg-slide-teal-strong hover:brightness-110',
    ink: 'bg-slide-ink hover:brightness-125',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full px-6 py-2.5 font-slide-body text-base font-extrabold uppercase tracking-label text-paper outline-offset-4 transition focus-visible:outline-[3px] focus-visible:outline-slide-teal-strong disabled:cursor-not-allowed disabled:opacity-40 ${bg}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/* ------------------------------- illustration ---------------------------- */

/**
 * Mascot with a speech bubble. Box is 380 x 431 design units (the right
 * hand side of the Paper title slide); all sizes are relative to its width.
 */
export function MascotArt({
  words,
  halo = true,
  className = '',
  tone = 'deck',
  float = false,
  decorative = false,
}: {
  words: string;
  halo?: boolean;
  className?: string;
  /** "page" swaps the deck's yellow accents for white, for the app chrome. */
  tone?: 'deck' | 'page';
  /** Gentle bob on the mascot and bubble; off for reduced motion. */
  float?: boolean;
  /** Pure decoration: hidden from assistive technology. */
  decorative?: boolean;
}) {
  const id = useId();
  const body = `${id}-body`;
  const shadow = `${id}-shadow`;
  const accent = tone === 'page' ? '#FFFFFF' : '#FFC93C';
  const bob = float ? 'mascot-float' : '';
  return (
    <div
      aria-hidden={decorative ? true : undefined}
      className={`@container relative aspect-[380/431] ${className}`}
    >
      {halo && (
        <div className="absolute left-0 top-[11.8%] aspect-square w-full rounded-full bg-white/[0.18]" />
      )}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`absolute left-[2.4%] top-0 w-[12.1%] ${
          tone === 'page' ? 'fill-white stroke-white' : 'fill-slide-sun stroke-slide-sun'
        }`}
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
      </svg>

      <div className={`absolute left-[24.9%] top-[23.4%] flex w-[70%] flex-col items-center ${bob}`}>
        <p
          className="flex min-h-[17.4cqw] w-full items-center justify-center rounded-[5.8cqw] bg-paper px-[3cqw] text-center font-slide-display text-[6.9cqw] font-bold leading-[1.15] tracking-[0.05em] text-slide-teal-strong shadow-[0_2.6cqw_6.3cqw_rgba(0,60,80,0.2)]"
          aria-label={decorative ? undefined : `Key words: ${words}`}
        >
          {words}
        </p>
        <div className="-mt-[2.6cqw] h-[5.3cqw] w-[5.3cqw] rotate-45 bg-paper" />
      </div>

      <svg
        viewBox="0 0 198 199"
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : 'A smiling mascot'}
        className={`absolute left-[33.9%] top-[50.8%] w-[52.1%] overflow-visible ${bob}`}
      >
        <defs>
          <linearGradient id={body} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#FF74A4" />
            <stop offset="1" stopColor="#FF2E7E" />
          </linearGradient>
          <filter id={shadow} x="-25%" y="-15%" width="150%" height="160%">
            <feDropShadow dx="0" dy="26" stdDeviation="22" floodColor="#FF2E7E" floodOpacity="0.35" />
          </filter>
        </defs>
        <rect width="198" height="199" rx="58" fill={`url(#${body})`} filter={`url(#${shadow})`} />
        <rect x="62" y="80" width="20" height="30" rx="10" fill="#20223A" />
        <rect x="130" y="80" width="20" height="30" rx="10" fill="#20223A" />
        <rect x="40" y="128" width="28" height="18" rx="9" fill="#FFFFFF" fillOpacity="0.35" />
        <rect x="146" y="128" width="28" height="18" rx="9" fill="#FFFFFF" fillOpacity="0.35" />
        <path
          d="M86 118c6 20 20 26 33 26S146 138 152 118"
          fill="none"
          stroke="#20223A"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <g transform="translate(-46 56)" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round">
          <path d="M6 6c10 8 10 42 0 50" />
          <path d="M24 14c6 6 6 28 0 34" />
        </g>
      </svg>
    </div>
  );
}

/** Light decoration around the title and recap art. Hidden on narrow frames. */
export function Sparkles() {
  return (
    <div aria-hidden="true" className="pointer-events-none hidden @3xl:block">
      <span className="absolute left-[48.4%] top-[16.7%] h-[1.4cqw] w-[1.4cqw] rounded-full bg-white/85" />
      <span className="absolute left-[50%] top-[77.8%] h-[2.3cqw] w-[2.3cqw] rounded-full bg-slide-pink" />
      <span className="absolute left-[54.7%] top-[65.3%] h-[2.8cqw] w-[2.8cqw] rounded-full border-[0.4cqw] border-white/55" />
      <svg
        viewBox="0 0 120 28"
        className="absolute left-[33.75%] top-[87.8%] w-[9.4%]"
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="6"
        strokeLinecap="round"
      >
        <path d="M4 14c10-14 20-14 28 0s18 14 28 0 18-14 28 0 18 14 28 0" />
      </svg>
    </div>
  );
}
