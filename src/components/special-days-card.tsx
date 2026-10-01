import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Avatar, Body, Button, Card, ErrorText, Heading, Row, useAccentText } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { startConversation } from '@/lib/messages';
import { formatMonthDay, upcoming, useSpecialDays, type UpcomingDay } from '@/lib/special-days';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Only worth a place on Home when someone's day is today or tomorrow.
const WINDOW_DAYS = 1;

function when(entry: UpcomingDay) {
  const date = formatMonthDay(entry.month, entry.day);
  if (entry.daysAway === 0) return 'Today';
  if (entry.daysAway === 1) return `Tomorrow · ${date}`;
  return `${date} · in ${entry.daysAway} days`;
}

function describe(entry: UpcomingDay) {
  const kind =
    entry.kind === 'birthday'
      ? 'Birthday'
      : entry.years
        ? `Anniversary, ${entry.years} ${entry.years === 1 ? 'year' : 'years'}`
        : 'Anniversary';
  return `${kind} · ${when(entry)}`;
}

/** Birthdays and anniversaries today and tomorrow, so the church can wish and pray for each other. */
export function SpecialDaysCard() {
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
    <Card>
      <Heading>Birthdays and anniversaries</Heading>
      {today.length ? <Body>{`Pray for ${today.map((entry) => entry.name).join(', ')} today.`}</Body> : null}
      <ErrorText>{error}</ErrorText>
      {coming.map((entry) => {
        const canWish = entry.daysAway === 0 && !!entry.user_id && entry.user_id !== userId;
        return (
          <Row
            key={`${entry.source}-${entry.id}`}
            title={entry.name}
            subtitle={canWish ? `${describe(entry)} · tap to send wishes` : describe(entry)}
            left={
              entry.source === 'member' ? (
                <Avatar name={entry.name} uri={publicUrl('avatars', entry.avatar_path)} />
              ) : (
                <Ionicons name={entry.kind === 'birthday' ? 'gift' : 'heart'} size={28} color={accent} />
              )
            }
            right={busy === entry.id ? <ActivityIndicator /> : undefined}
            onPress={canWish ? () => wish(entry) : undefined}
          />
        );
      })}
      {isLeader ? <Button title="Add or remove dates" variant="secondary" onPress={() => router.push('/special-days')} /> : null}
    </Card>
  );
}
