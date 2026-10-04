import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ActivityIndicator, View } from 'react-native';

import { Avatar, ErrorText, Row, useAccentText, ListSection } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { startConversation } from '@/lib/messages';
import { formatMonthDay, upcoming, useSpecialDays, type UpcomingDay } from '@/lib/special-days';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Only worth a place on Home when someone's day is today or tomorrow.
const WINDOW_DAYS = 1;

function when(entry: UpcomingDay, t: TFunction) {
  const date = formatMonthDay(entry.month, entry.day);
  if (entry.daysAway === 0) return t('specialDays.today');
  if (entry.daysAway === 1) return t('specialDays.tomorrow', { date });
  return t('specialDays.inDays', { date, count: entry.daysAway });
}

function describe(entry: UpcomingDay, t: TFunction) {
  const kind =
    entry.kind === 'birthday'
      ? t('specialDays.birthday')
      : entry.years
        ? t('specialDays.years', { count: entry.years })
        : t('specialDays.anniversary');
  return `${kind} · ${when(entry, t)}`;
}

/** Birthdays and anniversaries today and tomorrow, so the church can wish and pray for each other. */
export function SpecialDaysCard() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const userId = useUserId();
  const accent = useAccentText();
  const days = useSpecialDays(church_id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const coming = upcoming(days.data ?? [], WINDOW_DAYS);
  if (!coming.length) return null;

  async function wish(entry: UpcomingDay) {
    if (!entry.user_id || busy) return;
    setBusy(entry.id);
    setError(null);
    try {
      const id = await startConversation(church_id, entry.user_id);
      router.push({ pathname: '/chat/[id]', params: { id, name: entry.name } });
    } catch (e) {
      setError(friendlyError(e));
    }
    setBusy(null);
  }

  const today = coming.filter((entry) => entry.daysAway === 0);

  return (
    <>
      <ErrorText>{error}</ErrorText>
      <ListSection
        inset={54}
        footer={today.length ? t('specialDays.pray', { names: today.map((entry) => entry.name).join(', ') }) : undefined}>
      {coming.map((entry) => {
        const canWish = entry.daysAway === 0 && !!entry.user_id && entry.user_id !== userId;
        return (
          <Row
            key={`${entry.source}-${entry.id}`}
            title={entry.name}
            subtitle={canWish ? t('specialDays.wishes', { text: describe(entry, t) }) : describe(entry, t)}
            left={
              entry.source === 'member' ? (
                <Avatar name={entry.name} uri={publicUrl('avatars', entry.avatar_path)} />
              ) : (
                <View style={{ width: 40, alignItems: 'center' }}>
                  <Ionicons name={entry.kind === 'birthday' ? 'gift-outline' : 'heart-outline'} size={26} color={accent} />
                </View>
              )
            }
            right={busy === entry.id ? <ActivityIndicator /> : undefined}
            onPress={canWish ? () => wish(entry) : undefined}
          />
        );
      })}
      {isLeader ? <Row title={t('specialDays.manage')} onPress={() => router.push('/special-days')} /> : null}
      </ListSection>
    </>
  );
}
