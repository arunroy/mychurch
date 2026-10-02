import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/i18n';

import { dateKey, getDateLocale, parseDateKey } from './dates';
import type { FastingBreak, FastingSettings, FastingSlotEntry } from './database.types';
import { supabase } from './supabase';

// The fasting prayer timetable: half-hour slots on one Friday a month. The rules here mirror fasting_slot_ok in the
// database, which has the final say.

export type FastingConfig = {
  /** Which Friday of the month, 1 to 4. */
  nthFriday: number;
  /** 'HH:MM'. The end can be '24:00', midnight at the end of the day. */
  start: string;
  end: string;
  breaks: FastingBreak[];
};

export const FASTING_DEFAULTS: FastingConfig = {
  nthFriday: 3,
  start: '06:00',
  end: '24:00',
  breaks: [
    { start: '10:30', end: '11:30' },
    { start: '19:30', end: '21:30' },
  ],
};

const SLOT_MINUTES = 30;

/** 'HH:MM' (or 'HH:MM:SS' from the database) to minutes after midnight. '24:00' is 1440. */
export function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "6:00 AM", "12:00 AM" for midnight, in the person's language. */
export function timeLabel(minutes: number) {
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60) % 24, minutes % 60);
  return date.toLocaleTimeString(getDateLocale(), { hour: 'numeric', minute: '2-digit' });
}

export const isTime = (text: string) => /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(text.trim());
export const onHalfHour = (text: string) => toMinutes(text) % 30 === 0;

/** The nth Friday of a month, as a date key. */
export function nthFriday(year: number, month: number, n: number) {
  const first = new Date(year, month, 1);
  const firstFriday = 1 + ((5 - first.getDay() + 7) % 7);
  return dateKey(new Date(year, month, firstFriday + (n - 1) * 7));
}

/** The next `count` fasting days from today (today included), soonest first. */
export function upcomingFastingDays(n: number, count: number, from = dateKey()) {
  const days: string[] = [];
  const start = parseDateKey(from);
  for (let i = 0; days.length < count && i < 24; i++) {
    const key = nthFriday(start.getFullYear(), start.getMonth() + i, n);
    if (key >= from) days.push(key);
  }
  return days;
}

export type SlotOrBreak =
  | { kind: 'slot'; start: number; end: number; key: string }
  | { kind: 'break'; start: number; end: number };

/** The day in order: each half-hour slot, and each break where it falls. */
export function dayPlan(config: FastingConfig): SlotOrBreak[] {
  const start = toMinutes(config.start);
  const end = toMinutes(config.end);
  const breaks = config.breaks
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
    .sort((a, b) => a.start - b.start);
  const plan: SlotOrBreak[] = [];
  const shown = new Set<number>();
  for (let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES) {
    const inBreak = breaks.find((b) => m < b.end && m + SLOT_MINUTES > b.start);
    if (inBreak) {
      if (!shown.has(inBreak.start)) {
        shown.add(inBreak.start);
        plan.push({ kind: 'break', start: inBreak.start, end: inBreak.end });
      }
      continue;
    }
    plan.push({ kind: 'slot', start: m, end: m + SLOT_MINUTES, key: toTime(m) });
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function fromRow(row: FastingSettings | null): FastingConfig {
  if (!row) return FASTING_DEFAULTS;
  return {
    nthFriday: row.nth_friday,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    breaks: row.breaks,
  };
}

/** The church's settings, or the defaults until the Pastor saves some. `saved` says whether a row exists. */
export function useFastingSettings(churchId: string) {
  return useQuery({
    queryKey: ['fasting', churchId, 'settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fasting_settings').select('*').eq('church_id', churchId).maybeSingle();
      if (error) throw error;
      return { config: fromRow(data), saved: !!data };
    },
  });
}

export function useSaveFastingSettings(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ config, saved }: { config: FastingConfig; saved: boolean }) => {
      const values = { nth_friday: config.nthFriday, start_time: config.start, end_time: config.end, breaks: config.breaks };
      const { error } = saved
        ? await supabase.from('fasting_settings').update(values).eq('church_id', churchId)
        : await supabase.from('fasting_settings').insert({ church_id: churchId, ...values });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fasting', churchId] }),
  });
}

/** Who is praying when on a fasting day, by slot ('HH:MM'). */
export function useFastingTimetable(churchId: string, day: string) {
  return useQuery({
    queryKey: ['fasting', churchId, 'timetable', day],
    queryFn: async (): Promise<Map<string, FastingSlotEntry[]>> => {
      const { data, error } = await supabase.rpc('fasting_timetable', { p_church: churchId, p_day: day });
      if (error) throw error;
      const bySlot = new Map<string, FastingSlotEntry[]>();
      for (const entry of data) {
        const key = entry.slot_start.slice(0, 5);
        bySlot.set(key, [...(bySlot.get(key) ?? []), entry]);
      }
      return bySlot;
    },
  });
}

/** Takes or leaves a slot for the signed-in person, and sets or cancels their reminder on this phone. */
export function useToggleSlot(churchId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, slot, join }: { day: string; slot: string; join: boolean }) => {
      if (join) {
        const { error } = await supabase.from('fasting_signups').insert({ church_id: churchId, day, slot_start: slot, user_id: userId });
        if (error) throw error;
        // A reminder is a nicety: the slot is taken even if the phone won't allow one.
        await setSlotReminder(churchId, day, slot).catch(() => {});
      } else {
        const { error } = await supabase
          .from('fasting_signups')
          .delete()
          .eq('church_id', churchId)
          .eq('day', day)
          .eq('slot_start', slot)
          .eq('user_id', userId);
        if (error) throw error;
        await cancelSlotReminder(churchId, day, slot);
      }
    },
    onSuccess: (_, { day }) => queryClient.invalidateQueries({ queryKey: ['fasting', churchId, 'timetable', day] }),
  });
}

// ---------------------------------------------------------------------------
// Reminders, 15 minutes before each of the person's slots, scheduled by the phone itself
// ---------------------------------------------------------------------------

const REMINDER_KEY = 'fasting-reminders';
const REMINDER_MINUTES = 15;

async function readReminders(): Promise<Record<string, string>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(REMINDER_KEY)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeReminders(saved: Record<string, string>) {
  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(saved)).catch(() => {});
}

const reminderId = (churchId: string, day: string, slot: string) => `${churchId}:${day}:${slot}`;

async function setSlotReminder(churchId: string, day: string, slot: string) {
  if (Platform.OS === 'web') return;
  const minutes = toMinutes(slot);
  const startsAt = parseDateKey(day);
  startsAt.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const fireAt = new Date(startsAt.getTime() - REMINDER_MINUTES * 60 * 1000);
  if (fireAt.getTime() <= Date.now()) return;

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;

  await cancelSlotReminder(churchId, day, slot);
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('fasting.reminderTitle'),
      body: i18n.t('fasting.reminderBody', { time: timeLabel(minutes) }),
      data: { type: 'fasting' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: 'default' },
  });
  const saved = await readReminders();
  saved[reminderId(churchId, day, slot)] = notificationId;
  await writeReminders(saved);
}

async function cancelSlotReminder(churchId: string, day: string, slot: string) {
  const saved = await readReminders();
  const id = reminderId(churchId, day, slot);
  if (saved[id]) {
    await Notifications.cancelScheduledNotificationAsync(saved[id]).catch(() => {});
    delete saved[id];
    await writeReminders(saved);
  }
}
