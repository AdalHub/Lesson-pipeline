import { useId } from 'react';

/**
 * The lesson mascot's face, for the logo and other small spots. The full figure
 * with a speech bubble is MascotArt in components/lesson/parts.tsx.
 */
export function MascotFace({
  className = 'h-9 w-9',
  label,
}: {
  className?: string;
  /** Accessible name. Omit when the face is decoration next to real text. */
  label?: string;
}) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 198 199"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#FF74A4" />
          <stop offset="1" stopColor="#FF2E7E" />
        </linearGradient>
      </defs>
      <rect width="198" height="199" rx="58" fill={`url(#${id})`} />
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
    </svg>
  );
}
