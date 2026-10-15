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

/* ------------------------------------------------------------------------ */
/* Lesson (slide deck, v2)                                                   */
/*                                                                          */
/* Fixed slides, in the order a student should meet them. The order        */
/* and the fields are the pedagogy; the model fills them, it does not       */
/* decide them. See LESSON_DESIGN.md for the rationale behind each slide.   */
/* ------------------------------------------------------------------------ */

/** How a piece of text should be signalled on screen (dual coding). */
export const SEGMENT_ROLES = ['plain', 'key', 'mark', 'focus'] as const;

export const SegmentSchema = z.object({
  text: z.string(),
  role: z
    .enum(SEGMENT_ROLES)
    .describe(
      'plain: ordinary text. key: the element the student must notice (joining word, operator, keyword). mark: a small symbol or punctuation that matters (comma, equals sign, unit). focus: the result or answer part.',
    ),
});

const CheckedStatementSchema = z.object({
  statement: z.string().describe('The whole item as the student would see it.'),
  parts: z
    .array(
      z.object({
        text: z.string().describe('One part of the statement, in the order it appears.'),
        holds: z
          .boolean()
          .describe('Does this part pass the strategy check on its own?'),
        verdict: z
          .string()
          .describe('Two to four words shown as a chip, e.g. "whole" / "not whole".'),
      }),
    )
    .min(2)
    .max(3),
  conclusion: z
    .string()
    .describe('Short verdict for the whole statement, e.g. "Compound" or "Not compound".'),
});

export const LessonSchema = z
  .object({
    /** Written FIRST: the pedagogical plan the slides are built from. */
    plan: z.object({
      learningGoal: z
        .string()
        .describe('One sentence, teacher language: what the student will be able to do.'),
      priorKnowledge: z
        .string()
        .describe('One sentence: what the student already knows that this lesson builds on.'),
      coreMisconception: z
        .string()
        .describe(
          'The single most common wrong idea for this skill. Every distractor and the recap warning target it.',
        ),
      successCriteria: z
        .array(z.string())
        .min(2)
        .max(3)
        .describe('"I can ..." statements, student language.'),
    }),

    title: z.string().describe('Two to four punchy words. Lower grades: playful.'),
    skill: z.string().describe('The skill in plain words, e.g. "Joining Two Sentences".'),
    topic: z.string().describe('One or two words for the badge, e.g. "Grammar", "Multiplication".'),
    objective: z
      .string()
      .describe('One sentence, student language, starting with "Learn to".'),
    keyTerms: z
      .array(z.string())
      .min(1)
      .max(5)
      .describe(
        'The few single words or symbols at the heart of the skill, shown in a small speech bubble. One word or symbol each, e.g. ["and","but","or","so"] or ["+","-","x"]. Never phrases.',
      ),

    /** Slide 2: a concrete example before the abstract rule. */
    bigIdea: z.object({
      heading: z.string().describe('Up to eight words.'),
      rule: z.string().describe('The rule in one plain sentence, after the example.'),
      partLabel: z
        .string()
        .describe('Label for each input part, e.g. "Sentence", "Number", "Step".'),
      before: z
        .array(z.string())
        .min(1)
        .max(2)
        .describe(
          'The pieces BEFORE the transformation, each complete on its own. They must not contain the element the tap reveals (no joining word, operator or punctuation being taught).',
        ),
      actionLabel: z.string().describe('Verb phrase on the button, e.g. "Tap to join".'),
      after: z
        .array(SegmentSchema)
        .min(2)
        .describe('The result after the tap, as signalled segments.'),
      annotations: z
        .array(
          z.object({
            role: z.enum(['key', 'mark']),
            label: z.string().describe('What that element is and why it matters, briefly.'),
          }),
        )
        .max(2)
        .describe(
          'One per signalled element. A role may be annotated only if "after" has a segment with that role; the legend skips any that do not.',
        ),
    }),

    /** Slide 3: the variants of the idea, each with the same check. */
    teach: z.object({
      label: z.string().describe('Eyebrow, two to four words, e.g. "The joining words".'),
      heading: z.string(),
      prompt: z.string().describe('Tells the student to tap each case.'),
      cases: z
        .array(
          z.object({
            name: z
              .string()
              .describe(
                'Button text: the word, symbol or label itself, e.g. "and", "but", "x", "Melting". One to three words.',
              ),
            meaning: z.string().describe('Two to four words, e.g. "adds more", "a result".'),
            example: z.array(SegmentSchema).min(1),
            holds: z
              .boolean()
              .describe(
                'True when this case is an instance of the skill (the check passes). False for a contrasting case that shows what it is NOT.',
              ),
            check: z
              .string()
              .describe(
                'What the self-check finds for this case, worded the same way in every case, e.g. "both halves are whole sentences" or "a new substance is made".',
              ),
          }),
        )
        .min(2)
        .max(4),
    }),

    /** Slide 4: a named self-check with a contrasting example and non-example. */
    strategy: z.object({
      name: z.string().describe('Memorable name, e.g. "The Cover Test".'),
      label: z.string().describe('Eyebrow, e.g. "Try it · Cover test".'),
      instruction: z.string().describe('How to run the check, two sentences at most.'),
      example: CheckedStatementSchema,
      nonExample: CheckedStatementSchema.describe(
        'Looks like the concept but is not; must embody the core misconception.',
      ),
      rule: z
        .string()
        .describe('Decision rule in one line with an arrow, e.g. "Both halves whole -> compound."'),
    }),

    /** Slides 5 and 6: one guided item with elaborated feedback for every option. */
    guidedPractice: z.object({
      question: z.string(),
      reminder: z.string().describe('One sentence restating the rule.'),
      hint: z.string().describe('Points at the strategy without giving the answer.'),
      options: z
        .array(
          z.object({
            text: z.string(),
            correct: z.boolean(),
            feedback: z
              .string()
              .describe('Why this option is right or wrong, naming the parts. Shown after a tap.'),
          }),
        )
        .min(3)
        .max(3),
    }),

    /** Slide 7: independent retrieval practice, results hidden until finished. */
    quiz: z.object({
      heading: z.string(),
      items: z
        .array(
          z.object({
            prompt: z.string(),
            choices: z.array(z.string()).min(2).max(4).describe('One to three words each.'),
            answerIndex: z.number().int().min(0).max(3),
            explanation: z.string().describe('One sentence, shown with the results.'),
            targetsMisconception: z
              .boolean()
              .describe('True when the item is designed to catch the core misconception.'),
          }),
        )
        .min(3)
        .max(5),
    }),

    /** Slide 8: consolidation. */
    recap: z.object({
      heading: z.string().describe('Celebratory, e.g. "You are a sentence superstar!"'),
      takeaways: z
        .array(z.string())
        .min(2)
        .max(2)
        .describe('Two things to do, each a sentence a student could repeat tomorrow.'),
      watchOut: z
        .string()
        .describe(
          'The core misconception as a memorable warning. Shown as the third row after the takeaways.',
        ),
    }),
  })
  .superRefine((lesson, ctx) => {
    const correct = lesson.guidedPractice.options.filter((o) => o.correct).length;
    if (correct !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['guidedPractice', 'options'],
        message: `exactly one option must be correct (got ${correct})`,
      });
    }
    lesson.quiz.items.forEach((item, i) => {
      if (item.answerIndex >= item.choices.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['quiz', 'items', i, 'answerIndex'],
          message: 'answerIndex must point at one of the choices',
        });
      }
    });
    if (!lesson.quiz.items.some((item) => item.targetsMisconception)) {
      ctx.addIssue({
        code: 'custom',
        path: ['quiz', 'items'],
        message: 'at least one quiz item must target the core misconception',
      });
    }
    if (!lesson.strategy.example.parts.every((p) => p.holds)) {
      ctx.addIssue({
        code: 'custom',
        path: ['strategy', 'example', 'parts'],
        message: 'every part of the example must pass the check',
      });
    }
    if (lesson.strategy.nonExample.parts.every((p) => p.holds)) {
      ctx.addIssue({
        code: 'custom',
        path: ['strategy', 'nonExample', 'parts'],
        message: 'at least one part of the non-example must fail the check',
      });
    }
  });

/**
 * The pre-October-2026 lesson shape. Rows written before the slide deck
 * existed still carry it, so the reader keeps rendering them.
 */
export const LegacyLessonSchema = z.object({
  title: z.string(),
  objective: z.string(),
  prerequisites: z.array(z.string()),
  explanation: z.string(),
  workedExample: z.object({
    problem: z.string(),
    steps: z.array(z.object({ step: z.string(), explanation: z.string() })).min(2),
    answer: z.string(),
  }),
  commonMistakes: z
    .array(
      z.object({ mistake: z.string(), whyItHappens: z.string(), howToAvoid: z.string() }),
    )
    .min(1)
    .max(4),
  practiceProblems: z
    .array(z.object({ problem: z.string(), hint: z.string(), answer: z.string() }))
    .min(2)
    .max(5),
});

/** Either shape, for reading stored rows. */
export const StoredLessonSchema = z.union([LessonSchema, LegacyLessonSchema]);

export type Classification = z.infer<typeof ClassificationSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type LegacyLesson = z.infer<typeof LegacyLessonSchema>;
export type StoredLesson = z.infer<typeof StoredLessonSchema>;

export function isSlideLesson(content: unknown): content is Lesson {
  return (
    !!content &&
    typeof content === 'object' &&
    'plan' in content &&
    'quiz' in content &&
    'recap' in content
  );
}
