import type { Classification, Lesson } from '../src/server/ai/schemas';
export const classification: Classification = {
  reasoning: 'Two-digit joining problem.', gradeLevel: 2, gradeLevelConfidence: 'high',
  subject: 'math', teksStandard: '2.4C', teksDescription: 'Addition word problems.',
  questionType: 'word_problem', difficulty: 'on_grade', keyConcepts: ['addition'],
};
export const lesson: Lesson = {
  title: 'Adding groups', objective: 'Add two groups.', prerequisites: ['Counting'],
  explanation: 'Join both groups and count the total.',
  workedExample: { problem: '12 + 14', steps: [{ step: 'Add tens', explanation: '10 + 10 = 20' }, { step: 'Add ones', explanation: '2 + 4 = 6; total 26' }], answer: '26' },
  commonMistakes: [{ mistake: 'Subtracting', whyItHappens: 'Confusing actions', howToAvoid: 'Identify joining' }],
  practiceProblems: [{ problem: '11 + 12', hint: 'Join tens', answer: '23' }, { problem: '15 + 13', hint: 'Join ones', answer: '28' }],
};
