import { z } from 'zod';

export const SUBJECTS = [
  'math',
  'reading_language_arts',
  'science',
  'social_studies',
  'other',
] as const;

export const QUESTION_TYPES = [
  'multiple_choice',
  'short_answer',
  'word_problem',
  'computation',
  'essay',
  'other',
] as const;

export const ClassificationSchema = z.object({
  reasoning: z
    .string()
    .describe('Briefly, how you determined grade and subject. Write this FIRST.'),
  gradeLevel: z.number().int().min(1).max(12),
  gradeLevelConfidence: z.enum(['high', 'medium', 'low']),
  subject: z.enum(SUBJECTS),
  teksStandard: z
    .string()
    .describe('TEKS identifier, e.g. "5.3K". Use "unknown" if you cannot map it.'),
  teksDescription: z
    .string()
    .describe('Plain-language description of what that TEKS standard covers.'),
  questionType: z.enum(QUESTION_TYPES),
  difficulty: z.enum(['below_grade', 'on_grade', 'above_grade']),
  keyConcepts: z.array(z.string()).min(1).max(5),
});

export const LessonSchema = z.object({
  title: z.string(),
  objective: z
    .string()
    .describe('One sentence: what the student will be able to do.'),
  prerequisites: z.array(z.string()),
  explanation: z
    .string()
    .describe('Markdown. Teach the concept at the given grade level.'),
  workedExample: z.object({
    problem: z.string(),
    steps: z
      .array(
        z.object({
          step: z.string(),
          explanation: z.string().describe('WHY this step, not just what.'),
        }),
      )
      .min(2),
    answer: z.string(),
  }),
  commonMistakes: z
    .array(
      z.object({
        mistake: z.string(),
        whyItHappens: z.string(),
        howToAvoid: z.string(),
      }),
    )
    .min(1)
    .max(4),
  practiceProblems: z
    .array(
      z.object({
        problem: z.string(),
        hint: z.string(),
        answer: z.string(),
      }),
    )
    .min(2)
    .max(5),
});

export type Classification = z.infer<typeof ClassificationSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
