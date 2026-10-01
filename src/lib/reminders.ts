import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import type { ChurchEvent } from './database.types';

// "Remind me" for an event. The reminder is a notification the phone schedules for itself, so it works
// without any server and without push set up, but only on the phone where it was set. The web has none.

const KEY = 'event-reminders';

export const REMINDER_CHOICES = [
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 24 * 60 },
] as const;

export const remindersSupported = Platform.OS !== 'web';

type Saved = Record<string, { notificationId: string; minutes: number }>;

async function readSaved(): Promise<Saved> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Saved;
  } catch {
    return {};
  }
}

async function writeSaved(saved: Saved) {
  await AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
}

/** Cancels any reminder for the event. */
export async function cancelReminder(eventId: string) {
  const saved = await readSaved();
  const existing = saved[eventId];
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing.notificationId).catch(() => {});
    delete saved[eventId];
    await writeSaved(saved);
  }
}

/** Schedules a reminder the given number of minutes before the event starts. Throws a readable message if it can't. */
export async function setReminder(event: ChurchEvent, minutes: number) {
  const fireAt = new Date(new Date(event.starts_at).getTime() - minutes * 60 * 1000);
  if (fireAt.getTime() <= Date.now()) throw new Error('That time has already passed. Pick a shorter reminder.');

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') throw new Error('Allow notifications for MyChurch in your phone’s settings to get reminders.');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Church updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await cancelReminder(event.id);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: event.title,
      body: minutes >= 24 * 60 ? 'Tomorrow at your church.' : 'Starting in an hour.',
      data: { type: 'event', event_id: event.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: 'default' },
  });

  const saved = await readSaved();
  saved[event.id] = { notificationId, minutes };
  await writeSaved(saved);
}

/** Whether the event has yet to start. */
export function startsInFuture(event: ChurchEvent) {
  return new Date(event.starts_at).getTime() > Date.now();
}

/** The reminder set on this phone for an event, in minutes before the start, or null. */
export function useReminder(eventId: string) {
  const queryClient = useQueryClient();
  const reminder = useQuery({
    queryKey: ['reminder', eventId],
    queryFn: async () => (await readSaved())[eventId]?.minutes ?? null,
  });
  return {
    minutes: reminder.data ?? null,
    reload: () => queryClient.invalidateQueries({ queryKey: ['reminder', eventId] }),
  };
}
