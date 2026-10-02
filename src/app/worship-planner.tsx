import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Body, Button, Card, ErrorText, Heading, Loading, Screen } from '@/components/ui';
import { WorshipPlanView } from '@/components/worship-plan-view';
import { WorshipSheet } from '@/components/worship-sheet';
import { Spacing } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { dateKey, formatDay, thisSunday } from '@/lib/dates';
import { friendlyError } from '@/lib/supabase';
import { useDeleteWorshipPlan, useWorshipPlans, type WorshipPlanWithSongs } from '@/lib/worship';

// Where the Pastor, elders and worship leaders plan the Psalm and songs for the coming Sundays.
export default function WorshipPlannerScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { canPlanWorship } = usePermissions();
  const plans = useWorshipPlans(church_id);
  const remove = useDeleteWorshipPlan(church_id);
  const [editing, setEditing] = useState<WorshipPlanWithSongs | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (plans.isPending) return <Loading />;

  if (!canPlanWorship) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('worship.onlyPlanners')}</Body>
      </Screen>
    );
  }

  const today = dateKey();
  const sunday = thisSunday();
  const all = plans.data ?? [];
  const upcoming = all.filter((p) => p.service_date >= today);
  const past = all.filter((p) => p.service_date < today).reverse();

  function onDelete(plan: WorshipPlanWithSongs) {
    confirm(t('worship.deleteTitle'), t('worship.deleteMessage', { date: formatDay(plan.service_date) }), t('common.delete'), () =>
      remove.mutate(plan.id, { onError: (e) => setError(friendlyError(e)) }),
    );
  }

  function card(plan: WorshipPlanWithSongs) {
    return (
      <Card key={plan.id}>
        <Heading>{plan.service_date === sunday ? t('worship.thisSunday', { date: formatDay(plan.service_date) }) : formatDay(plan.service_date)}</Heading>
        <WorshipPlanView plan={plan} />
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          <Button title={t('worship.edit')} variant="secondary" onPress={() => setEditing(plan)} style={{ flex: 1 }} />
          <Button title={t('common.delete')} variant="danger" onPress={() => onDelete(plan)} style={{ flex: 1 }} />
        </View>
      </Card>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {plans.error ? <ErrorText>{friendlyError(plans.error)}</ErrorText> : null}
      <ErrorText>{error}</ErrorText>
      <Button title={t('worship.plan')} onPress={() => setEditing('new')} />
      <Button title={t('songs.title')} variant="secondary" onPress={() => router.push('/songs')} />

      {all.length === 0 ? (
        <Card>
          <Heading>{t('worship.noneTitle')}</Heading>
          <Body muted>{t('worship.noneLeader')}</Body>
        </Card>
      ) : null}

      {upcoming.map(card)}
      {past.length > 0 ? <Heading>{t('worship.pastHeading')}</Heading> : null}
      {past.map(card)}

      {editing ? (
        <WorshipSheet
          key={editing === 'new' ? 'new' : editing.id}
          existing={editing === 'new' ? null : editing}
          plans={all}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}
