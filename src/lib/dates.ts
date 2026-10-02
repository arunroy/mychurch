/** A day as the plain YYYY-MM-DD the database stores, in the phone's own time zone. */
export function dateKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Reads a YYYY-MM-DD key as a local date, avoiding the off-by-one that `new Date('2026-09-30')` causes west of UTC. */
export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidDateKey(key: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(parseDateKey(key)) === key;
}

/** 24-hour time as typed, like 18:30 or 9:05. */
export function isValidTime(time: string) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(time.trim());
}

/** A local date and time from a YYYY-MM-DD key and an HH:MM time. */
export function combineDateTime(key: string, time: string) {
  const [hours, minutes] = time.trim().split(':').map(Number);
  const date = parseDateKey(key);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function timeText(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Dates and times are written in the app's language, which the language provider sets here.
let locale: string | undefined;
export function setDateLocale(next: string | undefined) {
  locale = next;
}

export function getDateLocale() {
  return locale;
}

export function formatDay(key: string) {
  return parseDateKey(key).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** Time for today's messages, and the day for older ones. */
export function messageTime(date: Date) {
  if (dateKey(date) === dateKey()) return formatTime(date);
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function addDays(key: string, days: number) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** The coming Sunday, or today when today is Sunday. */
export function thisSunday(from = dateKey()) {
  return addDays(from, (7 - parseDateKey(from).getDay()) % 7);
}
