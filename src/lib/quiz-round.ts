// Builds one round of the Bible quiz. Pure and offline, so it is easy to test.

import { dateKey } from './dates';
import type { QuizLevel, QuizQuestion } from './database.types';
import { generatedQuestions, shuffle, type RoundQuestion } from './quiz-generated';

export const ROUND_SIZE = 10;
/** Church-written questions take at most this many places, so generated ones still add variety. */
const MAX_FROM_CHURCH = 7;

export const LEVELS: { level: QuizLevel; label: string; blurb: string }[] = [
  { level: 'little', label: 'Little kids', blurb: 'Favourite Bible stories' },
  { level: 'kids', label: 'Kids', blurb: 'People, places and the books of the Bible' },
  { level: 'youth', label: 'Youth', blurb: 'The whole Bible, the Gospels and the letters' },
];

/** The Monday of the week a date falls in, as YYYY-MM-DD in the phone's time zone. */
export function mondayKey(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dateKey(monday);
}

function fromChurch(q: QuizQuestion): RoundQuestion {
  return { question: q.question, options: q.options, correctIndex: q.correct_index, explanation: q.explanation, reference: q.reference };
}

/**
 * Ten questions for a level. Questions leaders planned for this week come first, then the rest of the
 * church's questions that are due, then generated ones to fill the round.
 */
export function buildRound(
  level: QuizLevel,
  churchQuestions: QuizQuestion[],
  now = new Date(),
  random: () => number = Math.random,
): RoundQuestion[] {
  const thisWeek = mondayKey(now);
  const today = dateKey(now);
  const due = churchQuestions.filter((q) => q.level === level && (q.week_of === null || q.week_of <= today));

  const featured = shuffle(due.filter((q) => q.week_of === thisWeek), random);
  const rest = shuffle(due.filter((q) => q.week_of !== thisWeek), random);
  const own = [...featured, ...rest].slice(0, MAX_FROM_CHURCH).map(fromChurch);

  const seen = new Set(own.map((q) => q.question));
  const filler = generatedQuestions(level, ROUND_SIZE, random).filter((q) => !seen.has(q.question));
  return shuffle([...own, ...filler.slice(0, ROUND_SIZE - own.length)], random);
}
