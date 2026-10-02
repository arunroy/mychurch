import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { FundraiserProgress } from '@/components/fundraiser-progress';
import { FundraiserSheet } from '@/components/fundraiser-sheets';
import { Body, Button, Card, ErrorText, Heading, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useFundraisers } from '@/lib/fundraisers';
import { formatMoney } from '@/lib/funds';
import { friendlyError } from '@/lib/supabase';

// Causes the church is raising money for. Everyone sees the progress; only the Pastor and elders see who gave.
export default function FundraisersScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { canRunFundraisers } = usePermissions();
  const list = useFundraisers(church_id);
  const [creating, setCreating] = useState(false);

  if (list.isPending) return <Loading />;

  const open = list.data?.filter((f) => f.status === 'active') ?? [];
  const closed = list.data?.filter((f) => f.status === 'closed') ?? [];

  function card(f: NonNullable<typeof list.data>[number]) {
    return (
      <Pressable key={f.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/fundraiser', params: { id: f.id } })}>
        <Card>
          <Heading>{f.title}</Heading>
          {f.description ? <Body muted>{f.description}</Body> : null}
          <FundraiserProgress fundraiser={f} />
          {f.my_pledge ? <Body muted>{t('fundraisers.youPledged', { amount: formatMoney(f.my_pledge, f.currency) })}</Body> : null}
        </Card>
      </Pressable>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {list.error ? <ErrorText>{friendlyError(list.error)}</ErrorText> : null}
      {canRunFundraisers ? <Button title={t('fundraisers.new')} onPress={() => setCreating(true)} /> : null}

      {list.data?.length === 0 ? (
        <Card>
          <Heading>{t('fundraisers.noneTitle')}</Heading>
          <Body muted>{canRunFundraisers ? t('fundraisers.noneLeader') : t('fundraisers.noneMember')}</Body>
        </Card>
      ) : null}

      {open.map(card)}

      {closed.length > 0 ? (
        <View style={styles.closed}>
          <Heading>{t('fundraisers.closedHeading')}</Heading>
          {closed.map(card)}
        </View>
      ) : null}

      <Body muted>{t('fundraisers.privacyNote')}</Body>

      {creating ? <FundraiserSheet existing={null} onClose={() => setCreating(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  closed: { gap: Spacing.three },
});
