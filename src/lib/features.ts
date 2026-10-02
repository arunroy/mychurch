import { useActiveChurch, useChurch } from './church';
import { supabase } from './supabase';

/**
 * Everything the Pastor can switch on for the church, with the translation key of its name. All are off until the
 * Pastor turns them on. Home, the member list, church settings, the More tab and SOS have no switch.
 * Keep this in step with `known_church_features()` in the database.
 */
export const FEATURES = [
  { key: 'bible', label: 'shortcuts.bible' },
  { key: 'bible_study', label: 'shortcuts.bibleStudy' },
  { key: 'daily_verse', label: 'shortcuts.dailyVerse' },
  { key: 'sermons', label: 'shortcuts.sermons' },
  { key: 'videos', label: 'shortcuts.videos' },
  { key: 'worship', label: 'shortcuts.worship' },
  { key: 'prayer', label: 'shortcuts.prayer' },
  { key: 'qa', label: 'shortcuts.qa' },
  { key: 'polls', label: 'shortcuts.polls' },
  { key: 'announcements', label: 'shortcuts.announcements' },
  { key: 'special_days', label: 'shortcuts.specialDays' },
  { key: 'fundraisers', label: 'shortcuts.fundraisers' },
  { key: 'funds', label: 'shortcuts.funds' },
  { key: 'reports', label: 'shortcuts.reports' },
  { key: 'calendar', label: 'tabs.calendar' },
  { key: 'chat', label: 'tabs.chat' },
  { key: 'messages', label: 'tabs.messages' },
] as const;

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
