import { isSlideLesson, type StoredLesson } from '@/server/ai/schemas';
import { LegacyLessonView } from './LegacyLessonView';
import { LessonPlayer } from './lesson/LessonPlayer';

/**
 * Entry point for rendering a stored lesson. New lessons are slide decks;
 * rows written before October 2026 keep the older document layout.
 */
export function LessonView({
  lesson,
  gradeLevel,
}: {
  lesson: StoredLesson;
  gradeLevel: number;
}) {
  if (isSlideLesson(lesson)) {
    return <LessonPlayer lesson={lesson} gradeLevel={gradeLevel} />;
  }
  return <LegacyLessonView lesson={lesson} />;
}
