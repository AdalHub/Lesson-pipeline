const SUBJECT_LABELS: Record<string, string> = {
  math: 'Math',
  reading_language_arts: 'Reading / Language Arts',
  science: 'Science',
  social_studies: 'Social Studies',
  other: 'Other',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-success-soft text-success',
  medium: 'bg-accent-soft text-accent',
  low: 'bg-danger-soft text-danger',
};

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

type Props = {
  gradeLevel: number;
  gradeLevelConfidence: string;
  subject: string;
  teksStandard: string;
  difficulty?: string;
  questionType?: string;
  compact?: boolean;
};

export function ClassificationBadge({
  gradeLevel,
  gradeLevelConfidence,
  subject,
  teksStandard,
  difficulty,
  questionType,
  compact = false,
}: Props) {
  const base =
    'inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`${base} border-accent/40 bg-accent-soft text-accent`}>
        {ordinal(gradeLevel)} grade
      </span>
      <span className={base}>{SUBJECT_LABELS[subject] ?? humanize(subject)}</span>
      <span className={`${base} font-mono`}>
        TEKS {teksStandard}
      </span>
      <span
        className={`${base} border-transparent ${CONFIDENCE_STYLES[gradeLevelConfidence] ?? ''}`}
        title="Confidence in the grade level"
      >
        {gradeLevelConfidence} confidence
      </span>
      {!compact && difficulty && (
        <span className={base}>{humanize(difficulty)}</span>
      )}
      {!compact && questionType && (
        <span className={base}>{humanize(questionType)}</span>
      )}
    </div>
  );
}
