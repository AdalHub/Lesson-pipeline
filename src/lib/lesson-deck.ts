/**
 * Pure logic for the lesson deck: step metadata, the interaction state
 * machine, scoring and title helpers. No React, no server imports, so the
 * same code runs in the player, the teacher panel and the unit tests.
 */
import type { Lesson } from '@/server/ai/schemas';

/** A student must score at least this share of the quiz to pass. */
export const PASS_THRESHOLD = 0.8;

/** Wrong picks in guided practice before the answer is shown. */
export const MAX_WRONG_PICKS = 2;

/**
 * The deck, in the order a student meets it. `principle` and `why` are shown
 * to teachers in the lesson design panel; `label` appears in the progress bar.
 * The reference deck has eight steps; steps 5 and 6 (question, then the
 * answered state) are one screen here because answering is what moves it.
 */
export const DECK_STEPS = [
  {
    id: 'title',
    label: 'Start',
    reference: '1 · Title',
    principle: 'Hook and goal',
    why: 'The student can state what they are about to learn before any content arrives.',
  },
  {
    id: 'bigIdea',
    label: 'Big idea',
    reference: '2 · Big idea',
    principle: 'Concrete before abstract',
    why: 'A tappable example happens first. The rule is stated after the student has seen it.',
  },
  {
    id: 'teach',
    label: 'Teach',
    reference: '3 · Teach',
    principle: 'Varied examples, one repeated check',
    why: 'Surface features change across cases while the check stays identical, so the student sees what is invariant.',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    reference: '4 · Cover test',
    principle: 'Contrasting cases and a named self-check',
    why: 'An example against a near-miss, with a short procedure the student can reuse on any new item.',
  },
  {
    id: 'practice',
    label: 'Practice',
    reference: '5-6 · Practice',
    principle: 'Guided retrieval with elaborated feedback',
    why: 'The student commits to an answer. Every option has feedback that names the reason, not just right or wrong.',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    reference: '7 · Quiz',
    principle: 'Independent retrieval and a mastery gate',
    why: 'No hints and no feedback until the end, then a visible pass mark so the result means something.',
  },
  {
    id: 'recap',
    label: 'Recap',
    reference: '8 · Recap',
    principle: 'Consolidation and the misconception warning',
    why: 'Three things to repeat tomorrow, ending on the mistake most likely to come back.',
  },
] as const;

export type StepId = (typeof DECK_STEPS)[number]['id'];

/* ----------------------------- quiz scoring ----------------------------- */

export type QuizScore = {
  correct: number;
  total: number;
  ratio: number;
  passed: boolean;
  /** Per item: true when the chosen answer matches. Unanswered counts as wrong. */
  perItem: boolean[];
};

export function scoreQuiz(
  answers: ReadonlyArray<number | null>,
  items: ReadonlyArray<{ answerIndex: number }>,
  threshold: number = PASS_THRESHOLD,
): QuizScore {
  const perItem = items.map((item, i) => answers[i] === item.answerIndex);
  const correct = perItem.filter(Boolean).length;
  const total = items.length;
  const ratio = total === 0 ? 0 : correct / total;
  return { correct, total, ratio, passed: total > 0 && ratio >= threshold, perItem };
}

/** How many more correct answers are needed to pass, 0 once passed. */
export function answersNeededToPass(score: QuizScore, threshold: number = PASS_THRESHOLD) {
  const need = Math.ceil(threshold * score.total - 1e-9);
  return Math.max(0, need - score.correct);
}

/* ------------------------------ title helpers ---------------------------- */

/** "Sentence Power!" -> head "Sentence", tail "Power!" (tail gets the accent). */
export function splitTitle(title: string): { head: string; tail: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { head: '', tail: title.trim() };
  return { head: words.slice(0, -1).join(' '), tail: words[words.length - 1]! };
}

/** Pick a display size so long titles wrap instead of overflowing. */
export function titleSize(title: string): 'slide-display' | 'slide-display-md' | 'slide-display-sm' {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const longest = Math.max(0, ...words.map((w) => w.length));
  const total = title.trim().length;
  if (longest <= 9 && total <= 15) return 'slide-display';
  if (longest <= 13 && total <= 24) return 'slide-display-md';
  return 'slide-display-sm';
}

/* ----------------------------- interaction state ------------------------- */

export type CardId = 'example' | 'nonExample';

export type DeckState = {
  /** Big idea: the student has tapped to join. */
  joined: boolean;
  /** Teach: the case on show and which ones the student has opened. */
  caseIndex: number;
  seenCases: number[];
  /** Strategy: which parts the student has tested alone. */
  tested: Record<CardId, boolean[]>;
  /** Guided practice. */
  practice: {
    wrongPicks: number[];
    lastPick: number | null;
    solved: boolean;
    /** The answer was shown after too many misses, not found. */
    revealed: boolean;
  };
  /** Quiz. */
  quiz: {
    answers: Array<number | null>;
    submitted: boolean;
    attempts: number;
  };
};

export type DeckAction =
  | { type: 'join' }
  | { type: 'unjoin' }
  | { type: 'case'; index: number }
  | { type: 'test'; card: CardId; part: number }
  | { type: 'pick'; index: number }
  | { type: 'answer'; item: number; choice: number }
  | { type: 'submit' }
  | { type: 'retry' };

export function initialDeckState(lesson: Lesson): DeckState {
  return {
    joined: false,
    caseIndex: 0,
    seenCases: [0],
    tested: {
      example: lesson.strategy.example.parts.map(() => false),
      nonExample: lesson.strategy.nonExample.parts.map(() => false),
    },
    practice: { wrongPicks: [], lastPick: null, solved: false, revealed: false },
    quiz: {
      answers: lesson.quiz.items.map(() => null),
      submitted: false,
      attempts: 0,
    },
  };
}

export function makeDeckReducer(lesson: Lesson) {
  const correctIndex = lesson.guidedPractice.options.findIndex((o) => o.correct);

  return function reduce(state: DeckState, action: DeckAction): DeckState {
    switch (action.type) {
      case 'join':
        return state.joined ? state : { ...state, joined: true };

      case 'unjoin':
        return state.joined ? { ...state, joined: false } : state;

      case 'case': {
        if (action.index < 0 || action.index >= lesson.teach.cases.length) return state;
        return {
          ...state,
          caseIndex: action.index,
          seenCases: state.seenCases.includes(action.index)
            ? state.seenCases
            : [...state.seenCases, action.index],
        };
      }

      case 'test': {
        const parts = state.tested[action.card];
        if (action.part < 0 || action.part >= parts.length) return state;
        const next = parts.map((value, i) => (i === action.part ? !value : value));
        return { ...state, tested: { ...state.tested, [action.card]: next } };
      }

      case 'pick': {
        const p = state.practice;
        if (p.solved) return state;
        if (action.index < 0 || action.index >= lesson.guidedPractice.options.length) return state;
        if (action.index === correctIndex) {
          return { ...state, practice: { ...p, lastPick: action.index, solved: true } };
        }
        const wrongPicks = p.wrongPicks.includes(action.index)
          ? p.wrongPicks
          : [...p.wrongPicks, action.index];
        const giveUp = wrongPicks.length >= MAX_WRONG_PICKS;
        return {
          ...state,
          practice: {
            wrongPicks,
            lastPick: giveUp ? correctIndex : action.index,
            solved: giveUp,
            revealed: giveUp,
          },
        };
      }

      case 'answer': {
        const q = state.quiz;
        if (q.submitted) return state;
        const item = lesson.quiz.items[action.item];
        if (!item || action.choice < 0 || action.choice >= item.choices.length) return state;
        const answers = q.answers.map((value, i) => (i === action.item ? action.choice : value));
        return { ...state, quiz: { ...q, answers } };
      }

      case 'submit': {
        const q = state.quiz;
        if (q.submitted || q.answers.some((a) => a === null)) return state;
        return { ...state, quiz: { ...q, submitted: true } };
      }

      case 'retry': {
        const q = state.quiz;
        if (!q.submitted) return state;
        return {
          ...state,
          quiz: {
            answers: q.answers.map(() => null),
            submitted: false,
            attempts: q.attempts + 1,
          },
        };
      }
    }
  };
}

/* ------------------------------ derived views ---------------------------- */

export type PartState = 'untested' | 'holds' | 'fails';

export function partState(tested: boolean, holds: boolean): PartState {
  if (!tested) return 'untested';
  return holds ? 'holds' : 'fails';
}

export function cardComplete(tested: ReadonlyArray<boolean>): boolean {
  return tested.length > 0 && tested.every(Boolean);
}

/** True once the student has tested every part of both cards. */
export function strategyUnlocked(state: DeckState): boolean {
  return cardComplete(state.tested.example) && cardComplete(state.tested.nonExample);
}

/**
 * One legend entry per annotation, each pointing at the matching segment of
 * its role (the second "key" annotation shows the second "key" segment).
 * Annotations without a segment are dropped rather than shown empty.
 */
export function legendItems(bigIdea: Lesson['bigIdea']) {
  return bigIdea.annotations.flatMap((a, index) => {
    const nth = bigIdea.annotations.slice(0, index).filter((x) => x.role === a.role).length;
    const sample = bigIdea.after.filter((s) => s.role === a.role)[nth];
    return sample ? [{ role: a.role, label: a.label, text: sample.text }] : [];
  });
}
