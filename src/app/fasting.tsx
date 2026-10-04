import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { FastingSettingsSheet } from '@/components/fasting-settings-sheet';
import { Body, Card, Checkmark, ErrorText, Heading, Loading, Row, Screen, Segmented, useAccentText } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { formatDay, getDateLocale, parseDateKey } from '@/lib/dates';
import { dayPlan, timeLabel, upcomingFastingDays, useFastingSettings, useFastingTimetable, useToggleSlot, type SlotOrBreak } from '@/lib/fasting';
import { friendlyError } from '@/lib/supabase';

/** Morning until noon, afternoon until 5 PM, then evening. */
function partOfDay(minutes: number) {
  return minutes < 12 * 60 ? 'morning' : minutes < 17 * 60 ? 'afternoon' : 'evening';
}

const shortDay = (key: string) => parseDateKey(key).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' });

// The fasting prayer timetable: half-hour slots on one Friday a month. Everyone sees who is praying when, and taps a
// slot to take it or leave it. A reminder goes off on their phone 15 minutes before each of their slots.
export default function FastingScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { canManageFasting } = usePermissions();
  const userId = useUserId()!;
  const settings = useFastingSettings(church_id);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const accentText = useAccentText();

  const config = settings.data?.config;
  const days = config ? upcomingFastingDays(config.nthFriday, 3) : [];
  const day = chosenDay && days.includes(chosenDay) ? chosenDay : days[0];

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: canManageFasting
            ? () => (
                <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={8}>
                  <Text style={{ color: accentText, fontSize: 17 }}>{t('fasting.settings')}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      {!config || !day ? (
        <Loading />
      ) : (
        <Timetable
          day={day}
          days={days}
          onDay={setChosenDay}
          plan={dayPlan(config)}
          churchId={church_id}
          userId={userId}
        />
      )}
      {editing && settings.data ? (
        <FastingSettingsSheet config={settings.data.config} saved={settings.data.saved} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}

function Timetable({
  day,
  days,
  onDay,
  plan,
  churchId,
  userId,
}: {
  day: string;
  days: string[];
  onDay: (day: string) => void;
  plan: SlotOrBreak[];
  churchId: string;
  userId: string;
}) {
  const { t } = useTranslation();
  const timetable = useFastingTimetable(churchId, day);
  const toggle = useToggleSlot(churchId, userId);
  const [error, setError] = useState<string | null>(null);

  const slots = plan.filter((p) => p.kind === 'slot');
  const bySlot = timetable.data;
  const covered = slots.filter((s) => (bySlot?.get(s.key)?.length ?? 0) > 0).length;
  const mine = slots.filter((s) => bySlot?.get(s.key)?.some((e) => e.user_id === userId)).length;

  function onSlot(key: string, joined: boolean) {
    setError(null);
    toggle.mutate({ day, slot: key, join: !joined }, { onError: (e) => setError(friendlyError(e)) });
  }

  const parts = (['morning', 'afternoon', 'evening'] as const)
    .map((part) => ({ part, items: plan.filter((p) => partOfDay(p.start) === part) }))
    .filter((p) => p.items.length > 0);

  return (
    <Screen edges={['bottom']}>
      {days.length > 1 ? <Segmented value={day} onChange={onDay} options={days.map((d) => ({ value: d, label: shortDay(d) }))} /> : null}

      <Card>
        <Heading>{formatDay(day)}</Heading>
        <Body muted>{t('fasting.covered', { covered, total: slots.length })}</Body>
        <Body muted>{mine > 0 ? t('fasting.yours', { count: mine }) : t('fasting.tapToJoin')}</Body>
      </Card>

      <ErrorText>{error ?? (timetable.error ? friendlyError(timetable.error) : null)}</ErrorText>
      {timetable.isPending ? <Loading /> : null}

      {bySlot
        ? parts.map(({ part, items }) => (
            <Card key={part}>
              <Heading>{t(`fasting.${part}`)}</Heading>
              {items.map((item) => {
                const range = `${timeLabel(item.start)} – ${timeLabel(item.end)}`;
                if (item.kind === 'break') {
                  return <Row key={`break-${item.start}`} title={range} subtitle={t('fasting.meeting')} />;
                }
                const people = bySlot.get(item.key) ?? [];
                const joined = people.some((p) => p.user_id === userId);
                const names = people.map((p) => (p.user_id === userId ? t('prayer.you') : p.full_name)).join(', ');
                return (
                  <Row
                    key={item.key}
                    title={range}
                    subtitle={names || t('fasting.nobody')}
                    right={<Checkmark visible={joined} />}
                    chevron={false}
                    onPress={toggle.isPending ? undefined : () => onSlot(item.key, joined)}
                  />
                );
              })}
            </Card>
          ))
        : null}

      <Body muted>{t('fasting.footer')}</Body>
    </Screen>
  );
}
