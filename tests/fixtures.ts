import type { Classification, LegacyLesson, Lesson } from '../src/server/ai/schemas';
export const classification: Classification = {
  reasoning: 'Two-digit joining problem.', gradeLevel: 2, gradeLevelConfidence: 'high',
  subject: 'math', teksStandard: '2.4C', teksDescription: 'Addition word problems.',
  questionType: 'word_problem', difficulty: 'on_grade', keyConcepts: ['addition'],
};
export const lesson: Lesson = {
  plan: {
    learningGoal: 'Add two two-digit numbers by joining tens and ones.',
    priorKnowledge: 'Students can count by tens and add numbers within 20.',
    coreMisconception: 'Adding the digits in any order, so tens get added to ones.',
    successCriteria: ['I can find the tens and ones in a number.', 'I can add tens with tens and ones with ones.'],
  },
  title: 'Tens and Ones!', skill: 'Adding Two-Digit Numbers', topic: 'Addition',
  objective: 'Learn to add two-digit numbers by joining tens and ones.', keyTerms: ['tens', 'ones', '+'],
  bigIdea: {
    heading: 'Tens join tens, ones join ones', rule: 'Add the tens together, add the ones together, then join them.',
    partLabel: 'Number', before: ['34', '25'], actionLabel: 'Tap to add',
    after: [{ text: '30 + 20', role: 'plain' }, { text: '+', role: 'key' }, { text: '4 + 5', role: 'plain' }, { text: '=', role: 'mark' }, { text: '59', role: 'focus' }],
    annotations: [{ role: 'key', label: 'plus joins the two groups' }, { role: 'mark', label: 'equals shows the total' }],
  },
  teach: {
    label: 'Two ways to add', heading: 'Ways to join tens and ones', prompt: 'Tap a way to see it work.',
    cases: [
      { name: 'Break apart', meaning: 'split the numbers', example: [{ text: '34 + 25', role: 'plain' }, { text: '=', role: 'mark' }, { text: '50 + 9', role: 'key' }, { text: '= 59', role: 'focus' }], holds: true, check: 'tens stay with tens' },
      { name: 'Count on', meaning: 'jump by tens', example: [{ text: '34', role: 'plain' }, { text: '+ 20', role: 'key' }, { text: '= 54, + 5', role: 'plain' }, { text: '= 59', role: 'focus' }], holds: true, check: 'tens stay with tens' },
    ],
  },
  strategy: {
    name: 'The Tens Check', label: 'Try it · Tens check', instruction: 'Look at each number. Point to the tens digit, then the ones digit.',
    example: { statement: '34 + 25 = 59', parts: [{ text: '30 + 20 = 50', holds: true, verdict: 'tens match' }, { text: '4 + 5 = 9', holds: true, verdict: 'ones match' }], conclusion: 'Correct' },
    nonExample: { statement: '34 + 25 = 77', parts: [{ text: '30 + 20 = 50', holds: true, verdict: 'tens match' }, { text: '4 + 25 = 29', holds: false, verdict: 'mixed up' }], conclusion: 'Not correct' },
    rule: 'Tens with tens and ones with ones -> correct sum.',
  },
  guidedPractice: {
    question: 'Which shows 42 + 36 the right way?', reminder: 'Tens join tens and ones join ones.', hint: 'Find the tens digit in each number first.',
    options: [
      { text: '40 + 30 and 2 + 6', correct: true, feedback: 'Tens with tens (40 + 30) and ones with ones (2 + 6) gives 78.' },
      { text: '40 + 6 and 2 + 30', correct: false, feedback: 'This mixes a tens digit with a ones digit.' },
      { text: '4 + 3 and 2 + 6', correct: false, feedback: 'The 4 and 3 are tens, so they are worth 40 and 30.' },
    ],
  },
  quiz: {
    heading: 'Spot the right sum',
    items: [
      { prompt: '21 + 14 = 35', choices: ['Correct', 'Not'], answerIndex: 0, explanation: '20 + 10 = 30 and 1 + 4 = 5.', targetsMisconception: false },
      { prompt: '21 + 14 = 62', choices: ['Correct', 'Not'], answerIndex: 1, explanation: 'The ones were added to the tens.', targetsMisconception: true },
      { prompt: '53 + 22 = 75', choices: ['Correct', 'Not'], answerIndex: 0, explanation: '50 + 20 = 70 and 3 + 2 = 5.', targetsMisconception: false },
    ],
  },
  recap: {
    heading: 'You are an adding star!',
    takeaways: ['Add tens with tens and ones with ones.', 'Join the two totals for the answer.'],
    watchOut: 'Never add a tens digit to a ones digit.',
  },
};
export const legacyLesson: LegacyLesson = {
  title: 'Adding groups', objective: 'Add two groups.', prerequisites: ['Counting'],
  explanation: 'Join both groups and count the total.',
  workedExample: { problem: '12 + 14', steps: [{ step: 'Add tens', explanation: '10 + 10 = 20' }, { step: 'Add ones', explanation: '2 + 4 = 6; total 26' }], answer: '26' },
  commonMistakes: [{ mistake: 'Subtracting', whyItHappens: 'Confusing actions', howToAvoid: 'Identify joining' }],
  practiceProblems: [{ problem: '11 + 12', hint: 'Join tens', answer: '23' }, { problem: '15 + 13', hint: 'Join ones', answer: '28' }],
};
