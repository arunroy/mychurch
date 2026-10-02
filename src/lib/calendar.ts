// Date maths for the calendar views. Days are YYYY-MM-DD keys in the phone's own time zone (see dates.ts),
// weeks start on Sunday, and a month is always drawn as six full weeks so the grid never changes height.

import { addDays, dateKey, parseDateKey } from './dates';

export type GridDay = { key: string; day: number; inMonth: boolean };

/** The Sunday on or before a day. */
export function startOfWeek(key: string) {
  return addDays(key, -parseDateKey(key).getDay());
}

/** The seven days of the week a day falls in, Sunday first. */
export function weekKeys(key: string) {
  const first = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Six weeks covering a month (month is 0 for January), including days of the months either side. */
export function monthGrid(year: number, month: number): GridDay[] {
  const first = dateKey(new Date(year, month, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const key = addDays(start, i);
    const date = parseDateKey(key);
    return { key, day: date.getDate(), inMonth: date.getMonth() === month };
  });
}

export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** "October 2026", in the app's language. */
export function monthTitle(year: number, month: number, locale?: string) {
  return new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** Just the month's name, for the year list. */
export function monthName(month: number, locale?: string) {
  return new Date(2024, month, 1).toLocaleDateString(locale, { month: 'long' });
}

/** Short weekday names, Sunday first. */
export function weekdayLabels(locale?: string) {
  // 4 January 2026 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 4 + i).toLocaleDateString(locale, { weekday: 'short' }));
}

/** "4 Oct – 10 Oct" for a week. */
export function weekRangeLabel(key: string, locale?: string) {
  const days = weekKeys(key);
  const short = (k: string) => parseDateKey(k).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return `${short(days[0])} – ${short(days[6])}`;
}

/** The first day after a range, for queries that ask "before this". */
export function dayAfter(key: string) {
  return addDays(key, 1);
}
