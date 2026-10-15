/**
 * Deterministic pedagogy checks on a generated lesson.
 *
 * The schema guarantees shape. These checks guarantee a few properties the
 * learning design depends on and that a model quietly skips: practice items
 * that are new, feedback that explains, a quiz that cannot be passed by
 * always tapping the same answer, and student text free of markup.
 *
 * Two levels:
 *   fix  - worth one corrective regeneration
 *   warn - recorded with the lesson, never blocks it
 *
 * Everything here is pure, so it runs in unit tests without a model.
 */
import type { Lesson } from './schemas';

export type QualityIssue = {
  level: 'fix' | 'warn';
  code: string;
  path: string;
  message: string;
};

export type QualityContext = {
  gradeLevel: number;
  /** The original question text, when the input was text. */
  question?: string;
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/**
 * Comparison key for "is this the same item": lower case, sentence punctuation
 * and quotes removed, maths symbols kept (so "6 + 5" and "6 - 5" differ).
 */
const sameKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,!?;:'"‘’“”()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Letters and digits only, for word-overlap checks. */
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'they', 'them', 'when', 'what', 'have', 'will',
  'your', 'only', 'every', 'each', 'into', 'than', 'then', 'there', 'their', 'more', 'most',
  'same', 'because', 'about', 'which', 'would', 'could', 'should', 'never', 'always', 'not',
]);

function contentWords(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word match for words, plain substring match for symbols and punctuation. */
function containsElement(piece: string, element: string): boolean {
  if (/^[\p{L}\p{N}]+$/u.test(element)) {
    const edge = '[^\\p{L}\\p{N}]';
    return new RegExp(`(^|${edge})${escapeRegExp(element)}($|${edge})`, 'iu').test(piece);
  }
  return piece.includes(element);
}

/** Every string in the lesson with a dotted path. */
export function lessonStrings(lesson: unknown): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') out.push({ path, text: value });
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(lesson, '');
  return out;
}

// "__" is deliberately absent: it is a legitimate blank in maths ("5 + __ = 9").
const MARKUP = /\*\*|`|^\s{0,3}#{1,6}\s|\\\(|\\\[|\\frac|\\times|\$\$/m;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Mean words per sentence we accept before warning, by grade. */
function sentenceBudget(grade: number): number {
  if (grade <= 2) return 10;
  if (grade <= 3) return 12;
  if (grade <= 5) return 16;
  if (grade <= 8) return 22;
  return 28;
}

function meanSentenceWords(texts: string[]): number {
  const sentences = texts
    .flatMap((t) => t.split(/(?<=[.!?])\s+/))
    .map((s) => words(s).length)
    .filter((n) => n > 0);
  if (sentences.length === 0) return 0;
  return sentences.reduce((a, b) => a + b, 0) / sentences.length;
}

export function lessonQualityIssues(lesson: Lesson, ctx: QualityContext): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const add = (level: QualityIssue['level'], code: string, path: string, message: string) =>
    issues.push({ level, code, path, message });

  /* ---- text hygiene ---- */
  for (const { path, text } of lessonStrings(lesson)) {
    if (text.trim() === '') add('fix', 'empty', path, 'is empty');
    else if (MARKUP.test(text)) add('fix', 'markup', path, 'uses Markdown or LaTeX; write plain text');
    else if (EMOJI.test(text)) add('fix', 'emoji', path, 'contains an emoji; use plain text');
  }

  /* ---- guided practice ---- */
  const g = lesson.guidedPractice;
  const optionKeys = g.options.map((o) => sameKey(o.text));
  if (new Set(optionKeys).size !== optionKeys.length) {
    add('fix', 'options-unique', 'guidedPractice.options', 'two options have the same text');
  }
  g.options.forEach((option, i) => {
    if (words(option.feedback).length < 5) {
      add(
        'fix',
        'feedback-thin',
        `guidedPractice.options[${i}].feedback`,
        'feedback must explain why in at least a full sentence, naming the parts',
      );
    }
  });

  /* ---- quiz ---- */
  const q = lesson.quiz;
  if (q.items.length >= 3 && new Set(q.items.map((i) => i.answerIndex)).size === 1) {
    add('fix', 'quiz-same-answer', 'quiz.items', 'every item has the same correct choice; mix them so guessing cannot pass');
  }
  // The same stem with different choices ("Which is compound?") is a different item.
  const promptKeys = q.items.map(
    (i) => `${sameKey(i.prompt)} | ${i.choices.map(sameKey).sort().join(' / ')}`,
  );
  if (new Set(promptKeys).size !== promptKeys.length) {
    add('fix', 'quiz-duplicate', 'quiz.items', 'two quiz items are the same');
  }
  q.items.forEach((item, i) => {
    const keys = item.choices.map(sameKey);
    if (new Set(keys).size !== keys.length) {
      add('fix', 'choices-unique', `quiz.items[${i}].choices`, 'two choices are the same');
    }
  });
  const practiceKeys = new Set([sameKey(g.question), ...optionKeys]);
  q.items.forEach((item, i) => {
    if (practiceKeys.has(sameKey(item.prompt))) {
      add('fix', 'quiz-recycles-practice', `quiz.items[${i}].prompt`, 'repeats the guided practice item; the quiz needs new items');
    }
  });

  /* ---- the original question must not be taught back verbatim ---- */
  if (ctx.question) {
    const original = sameKey(ctx.question);
    // 'copy' = the original or a long chunk of it; 'echo' = a short shared phrase
    // such as the question stem, which is expected and only worth a note.
    const kind = (text: string): 'copy' | 'echo' | null => {
      const t = sameKey(text);
      if (t.length < 12) return null;
      if (t === original || (original.length >= 12 && t.includes(original))) return 'copy';
      if (original.includes(t)) return t.length >= 40 ? 'copy' : 'echo';
      return null;
    };
    const checks: Array<[string, string]> = [
      ['guidedPractice.question', g.question],
      ...g.options.map((o, i): [string, string] => [`guidedPractice.options[${i}].text`, o.text]),
      ...q.items.map((it, i): [string, string] => [`quiz.items[${i}].prompt`, it.prompt]),
      ...lesson.bigIdea.before.map((b, i): [string, string] => [`bigIdea.before[${i}]`, b]),
    ];
    for (const [path, text] of checks) {
      const found = kind(text);
      if (found === 'copy') {
        add('fix', 'reuses-question', path, 'is the original question; write a new item of the same type');
      } else if (found === 'echo') {
        add('warn', 'echoes-question', path, 'reuses wording from the original question; use a different context');
      }
    }
  }

  /* ---- advisory ---- */
  if (words(lesson.title).length > 6) add('warn', 'title-long', 'title', 'is longer than six words');
  for (const [path, text] of [
    ['bigIdea.heading', lesson.bigIdea.heading],
    ['teach.heading', lesson.teach.heading],
    ['quiz.heading', lesson.quiz.heading],
  ] as const) {
    if (words(text).length > 10) add('warn', 'heading-long', path, 'is longer than ten words');
  }

  lesson.bigIdea.annotations.forEach((a, i) => {
    if (!lesson.bigIdea.after.some((s) => s.role === a.role)) {
      add('warn', 'annotation-orphan', `bigIdea.annotations[${i}]`, `role "${a.role}" has no segment in "after"; the legend will skip it`);
    }
  });
  if (lesson.bigIdea.annotations.length === 0) {
    add('warn', 'annotation-none', 'bigIdea.annotations', 'the signalled elements are not explained');
  }
  if (lesson.teach.cases.every((c) => !c.holds)) {
    add('warn', 'teach-no-instance', 'teach.cases', 'no case is an instance of the skill');
  }
  if (lesson.keyTerms.some((t) => words(t).length > 2) || lesson.keyTerms.join(' ').length > 28) {
    add('warn', 'key-terms-long', 'keyTerms', 'should be a few single words or symbols for the speech bubble');
  }
  // Highlighted numbers and punctuation legitimately appear in the "before"
  // text, so only words are compared and the result is advisory: it exists to
  // catch a joining word already sitting on the card.
  const revealed = lesson.bigIdea.after
    .filter((seg) => seg.role === 'key' || seg.role === 'mark')
    .map((seg) => seg.text.trim())
    .filter((text) => /^\p{L}+$/u.test(text));
  lesson.bigIdea.before.forEach((piece, i) => {
    const hit = revealed.find((text) => containsElement(piece, text));
    if (hit) {
      add('warn', 'before-reveals', `bigIdea.before[${i}]`, `already contains "${hit}", which the tap is meant to reveal`);
    }
  });
  if (lesson.strategy.example.parts.length !== lesson.strategy.nonExample.parts.length) {
    add('warn', 'strategy-unbalanced', 'strategy', 'example and non-example have a different number of parts');
  }
  lesson.plan.successCriteria.forEach((c, i) => {
    if (!/^i can\b/i.test(c.trim())) add('warn', 'criteria-voice', `plan.successCriteria[${i}]`, 'should start with "I can"');
  });
  if (!/^learn to\b/i.test(lesson.objective.trim())) {
    add('warn', 'objective-voice', 'objective', 'should start with "Learn to"');
  }

  const misconception = contentWords(lesson.plan.coreMisconception);
  const warning = contentWords(lesson.recap.watchOut);
  if (misconception.size > 0 && ![...warning].some((w) => misconception.has(w))) {
    add('warn', 'misconception-echo', 'recap.watchOut', 'does not mention the misconception the lesson was built around');
  }

  const studentText = [
    lesson.bigIdea.rule,
    lesson.strategy.instruction,
    lesson.guidedPractice.reminder,
    lesson.guidedPractice.hint,
    ...lesson.guidedPractice.options.map((o) => o.feedback),
    ...lesson.quiz.items.map((i) => i.explanation),
    ...lesson.recap.takeaways,
    lesson.recap.watchOut,
  ];
  const mean = meanSentenceWords(studentText);
  const budget = sentenceBudget(ctx.gradeLevel);
  if (mean > budget) {
    add(
      'warn',
      'reading-level',
      'lesson',
      `average sentence is ${mean.toFixed(1)} words; aim for about ${budget} or fewer at grade ${ctx.gradeLevel}`,
    );
  }

  return issues;
}

export const needsRepair = (issues: QualityIssue[]) => issues.some((i) => i.level === 'fix');

/** Issue list as a note the model can act on. */
export function repairNote(issues: QualityIssue[]): string {
  return issues
    .filter((i) => i.level === 'fix')
    .slice(0, 8)
    .map((i) => `- ${i.path}: ${i.message}`)
    .join('\n');
}

/**
 * Models place the correct option first far more often than chance.
 * Shuffle once at generation time, and persist the result, so every view
 * of the lesson shows the same order.
 */
export function shuffleGuidedOptions(lesson: Lesson, random: () => number = Math.random): Lesson {
  const options = [...lesson.guidedPractice.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return { ...lesson, guidedPractice: { ...lesson.guidedPractice, options } };
}

/**
 * The same idea for quiz items whose choices are whole phrases or sentences.
 * Short paired choices ("Compound" / "Not") keep their meaningful order.
 */
export function shuffleQuizChoices(lesson: Lesson, random: () => number = Math.random): Lesson {
  const items = lesson.quiz.items.map((item) => {
    if (!item.choices.some((c) => c.length > 16)) return item;
    const order = item.choices.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    return {
      ...item,
      choices: order.map((i) => item.choices[i]!),
      answerIndex: order.indexOf(item.answerIndex),
    };
  });
  return { ...lesson, quiz: { ...lesson.quiz, items } };
}

/** Fixes that need no judgement: answer positions carry no signal. */
export function normalizeLesson(lesson: Lesson, random: () => number = Math.random): Lesson {
  return shuffleQuizChoices(shuffleGuidedOptions(lesson, random), random);
}
