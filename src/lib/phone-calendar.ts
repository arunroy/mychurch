import { Platform } from 'react-native';

import type { ChurchEvent } from './database.types';

export const phoneCalendarSupported = Platform.OS !== 'web';

/**
 * Opens the phone's own "new event" screen with this event filled in, so the person can save it to their
 * calendar. The phone's screen does the saving, so the app needs no access to the calendar itself.
 * Returns whether it was saved.
 */
export async function addToPhoneCalendar(event: ChurchEvent): Promise<boolean> {
  const Calendar = await import('expo-calendar/legacy');
  const result = await Calendar.createEventInCalendarAsync({
    title: event.title,
    startDate: new Date(event.starts_at),
    endDate: event.ends_at ? new Date(event.ends_at) : new Date(new Date(event.starts_at).getTime() + 60 * 60 * 1000),
    location: event.location || undefined,
    notes: event.description || undefined,
  });
  return result.action === 'saved';
}
