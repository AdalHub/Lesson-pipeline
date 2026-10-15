import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { StoredLesson } from '@/server/ai/schemas';

export const inputTypeEnum = pgEnum('input_type', ['text', 'image']);
export const confidenceEnum = pgEnum('confidence', ['high', 'medium', 'low']);
export const difficultyEnum = pgEnum('difficulty', [
  'below_grade',
  'on_grade',
  'above_grade',
]);

/**
 * Authoritative standards used by the retrieval step before classification.
 *
 * `searchText` is deliberately materialized rather than generated so a later
 * ingestion job can add synonyms teachers actually use (for example,
 * "equal groups" alongside "multiplication"). Postgres' built-in full-text
 * search indexes it; no separate vector database is required for this corpus.
 */
export const teksStandards = pgTable(
  'teks_standards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    subject: text('subject').notNull(),
    gradeLevel: integer('grade_level').notNull(),
    course: text('course'),
    knowledgeAndSkills: text('knowledge_and_skills').notNull(),
    studentExpectation: text('student_expectation').notNull(),
    description: text('description').notNull(),
    effectiveVersion: text('effective_version').notNull(),
    sourceUrl: text('source_url').notNull(),
    sourceKind: text('source_kind').default('official').notNull(),
    searchText: text('search_text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('teks_standards_subject_code_version_unique').on(
      table.subject,
      table.code,
      table.effectiveVersion,
    ),
    index('teks_standards_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.searchText})`,
    ),
  ],
);

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
  content: jsonb('content').$type<StoredLesson>().notNull(),
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
export type TeksStandardRow = typeof teksStandards.$inferSelect;
