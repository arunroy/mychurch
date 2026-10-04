import type { IconName } from '@/components/ui';
import type { IconColors } from '@/constants/theme';

import { useActiveChurch, useChurch } from './church';
import { supabase } from './supabase';

/**
 * Everything the Pastor can switch on for the church, with the translation key of its name. All are off until the
 * Pastor turns them on. Home, the member list, church settings, the More tab and SOS have no switch.
 * Keep this in step with `known_church_features()` in the database.
 */
export const FEATURES = [
  { key: 'bible', label: 'shortcuts.bible', icon: 'book-outline', color: 'blue' },
  { key: 'bible_study', label: 'shortcuts.bibleStudy', icon: 'school-outline', color: 'indigo' },
  { key: 'daily_verse', label: 'shortcuts.dailyVerse', icon: 'sparkles-outline', color: 'indigo' },
  { key: 'sermons', label: 'shortcuts.sermons', icon: 'document-text-outline', color: 'green' },
  { key: 'videos', label: 'shortcuts.videos', icon: 'play-outline', color: 'red' },
  { key: 'worship', label: 'shortcuts.worship', icon: 'musical-notes-outline', color: 'purple' },
  { key: 'prayer', label: 'shortcuts.prayer', icon: { material: 'hands-pray' }, color: 'pink' },
  { key: 'fasting', label: 'shortcuts.fasting', icon: 'time-outline', color: 'orange' },
  { key: 'qa', label: 'shortcuts.qa', icon: 'help-outline', color: 'orange' },
  { key: 'polls', label: 'shortcuts.polls', icon: 'stats-chart-outline', color: 'amber' },
  { key: 'announcements', label: 'shortcuts.announcements', icon: 'megaphone-outline', color: 'cyan' },
  { key: 'special_days', label: 'shortcuts.specialDays', icon: 'gift-outline', color: 'orange' },
  { key: 'fundraisers', label: 'shortcuts.fundraisers', icon: 'heart-outline', color: 'pink' },
  { key: 'funds', label: 'shortcuts.funds', icon: 'cash-outline', color: 'green' },
  { key: 'reports', label: 'shortcuts.reports', icon: 'flag-outline', color: 'gray' },
  { key: 'calendar', label: 'tabs.calendar', icon: 'calendar-outline', color: 'red' },
  { key: 'chat', label: 'tabs.chat', icon: 'chatbubbles-outline', color: 'blue' },
  { key: 'messages', label: 'tabs.messages', icon: 'mail-outline', color: 'cyan' },
] as const satisfies readonly { key: string; label: string; icon: IconName; color: keyof typeof IconColors }[];

export type FeatureKey = (typeof FEATURES)[number]['key'];

/** Whether the Pastor has turned a feature on for the active church. */
export function useFeature(key: FeatureKey) {
  return useActiveChurch().church.enabled_features.includes(key);
}

/** The features that are on, for screens that check several. */
export function useEnabledFeatures() {
  const set = new Set(useActiveChurch().church.enabled_features);
  return (key: FeatureKey) => set.has(key);
}

/** Saves the whole list of features that are on. Only a Pastor can; the database refuses anyone else. */
export function useSaveFeatures() {
  const { refresh } = useChurch();
  const { church_id } = useActiveChurch();
  return async (features: FeatureKey[]) => {
    const { error } = await supabase.rpc('set_church_features', { p_church: church_id, p_features: features });
    if (error) throw error;
    await refresh();
  };
}
