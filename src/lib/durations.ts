/** "How long should this last" choices for announcements and polls. `days: null` means no end. */
export type Duration = { label: string; days: number | null };

export const SHORT_DURATIONS: Duration[] = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
];

/** The moment that many days from now, or null for no end. */
export function endsAfter(days: number | null): Date | null {
  return days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
