import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { Lesson } from '@/server/ai/schemas';

export const inputTypeEnum = pgEnum('input_type', ['text', 'image']);
export const confidenceEnum = pgEnum('confidence', ['high', 'medium', 'low']);
export const difficultyEnum = pgEnum('difficulty', [
  'below_grade',
  'on_grade',
  'above_grade',
]);

export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  inputType: inputTypeEnum('input_type').notNull(),
  rawText: text('raw_text'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const classifications = pgTable('classifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id')
    .notNull()
    .references(() => submissions.id, { onDelete: 'cascade' }),
  gradeLevel: integer('grade_level').notNull(),
  gradeLevelConfidence: confidenceEnum('grade_level_confidence').notNull(),
  subject: text('subject').notNull(),
  teksStandard: text('teks_standard').notNull(),
  teksDescription: text('teks_description').notNull(),
  questionType: text('question_type').notNull(),
  difficulty: difficultyEnum('difficulty').notNull(),
  keyConcepts: jsonb('key_concepts').$type<string[]>().notNull(),
  reasoning: text('reasoning').notNull(),
  model: text('model').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  rawResponse: jsonb('raw_response'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id')
    .notNull()
    .references(() => submissions.id, { onDelete: 'cascade' }),
  classificationId: uuid('classification_id')
    .notNull()
    .references(() => classifications.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: jsonb('content').$type<Lesson>().notNull(),
  model: text('model').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const submissionsRelations = relations(submissions, ({ many }) => ({
  classifications: many(classifications),
  lessons: many(lessons),
}));

export const classificationsRelations = relations(
  classifications,
  ({ one, many }) => ({
    submission: one(submissions, {
      fields: [classifications.submissionId],
      references: [submissions.id],
    }),
    lessons: many(lessons),
  }),
);

export const lessonsRelations = relations(lessons, ({ one }) => ({
  submission: one(submissions, {
    fields: [lessons.submissionId],
    references: [submissions.id],
  }),
  classification: one(classifications, {
    fields: [lessons.classificationId],
    references: [classifications.id],
  }),
}));

export type Submission = typeof submissions.$inferSelect;
export type ClassificationRow = typeof classifications.$inferSelect;
export type LessonRow = typeof lessons.$inferSelect;
