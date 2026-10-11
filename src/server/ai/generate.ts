import { generateObject, type UserContent } from 'ai';
import { GENERATE_MODEL_ID, getModel } from './model';
import { imageFilePart } from './parts';
import { LessonSchema, type Classification, type Lesson } from './schemas';

export const GENERATE_SYSTEM = `
You write short, focused lessons that teach a student how to solve a
specific type of test question.

You will be given a question and its classification (grade level, subject,
TEKS standard, key concepts). Write the lesson FOR THAT GRADE LEVEL —
vocabulary, sentence length, and examples must suit that age.

Teach the underlying method so the student can solve similar problems,
not just this one. Do not simply give the answer.

Guidelines:
- The explanation is Markdown. Use short paragraphs, and bullet lists or numbered
  steps where they help. Use plain text math (e.g. 3 x 4 = 12, x^2) rather than LaTeX.
- The worked example should be a NEW problem of the same type, not the original question.
- Practice problems should also be new problems, increasing slightly in difficulty.
- Hints should nudge, not solve.
- Lower grades: short sentences, concrete objects, friendly tone. Upper grades:
  precise vocabulary, formal reasoning, and notation appropriate to the course.
`.trim();

export type GenerateInput = {
  /** The original question, or the screenshot it appears in. */
  question:
    | { kind: 'text'; text: string }
    | { kind: 'image'; imageDataUrl: string };
  classification: Classification;
};

export type GenerateResult = {
  lesson: Lesson;
  model: string;
  latencyMs: number;
  rawResponse: unknown;
};

export const SUBJECT_LABELS: Record<Classification['subject'], string> = {
  math: 'Math',
  reading_language_arts: 'Reading / Language Arts',
  science: 'Science',
  social_studies: 'Social Studies',
  other: 'Other',
};

function describeClassification(c: Classification) {
  return [
    `Grade level: ${c.gradeLevel}`,
    `Subject: ${SUBJECT_LABELS[c.subject]}`,
    `TEKS: ${c.teksStandard} — ${c.teksDescription}`,
    `Question type: ${c.questionType.replace(/_/g, ' ')}`,
    `Difficulty: ${c.difficulty.replace(/_/g, ' ')}`,
    `Key concepts: ${c.keyConcepts.join(', ')}`,
  ].join('\n');
}

function buildUserContent(input: GenerateInput): UserContent {
  const meta = describeClassification(input.classification);

  if (input.question.kind === 'text') {
    return [
      {
        type: 'text',
        text: `Question:\n${input.question.text}\n\n${meta}\n\nWrite the lesson.`,
      },
    ];
  }

  return [
    {
      type: 'text',
      text: `Question: (shown in the attached screenshot)\n\n${meta}\n\nWrite the lesson.`,
    },
    imageFilePart(input.question.imageDataUrl),
  ];
}

/** CALL 2 — generate a lesson, given the question and call 1's classification. */
export async function generateLesson(
  input: GenerateInput,
  modelId: string = GENERATE_MODEL_ID,
): Promise<GenerateResult> {
  const started = performance.now();

  const result = await generateObject({
    model: getModel(modelId),
    schema: LessonSchema,
    schemaName: 'Lesson',
    schemaDescription:
      'A short lesson teaching a student how to solve this type of question.',
    instructions: GENERATE_SYSTEM,
    messages: [{ role: 'user', content: buildUserContent(input) }],
    temperature: 0.7,
  });

  const latencyMs = Math.round(performance.now() - started);

  return {
    lesson: result.object,
    model: result.response.modelId || modelId,
    latencyMs,
    rawResponse: {
      finishReason: result.finishReason,
      usage: result.usage,
      responseId: result.response.id,
      modelId: result.response.modelId,
    },
  };
}
