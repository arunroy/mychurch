import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { FundraiserProgress } from '@/components/fundraiser-progress';
import { FundraiserSheet, PledgeSheet, ReceivedSheet } from '@/components/fundraiser-sheets';
import { Body, Button, Card, ErrorText, Heading, Loading, Row, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { formatDay } from '@/lib/dates';
import type { FundraiserEntry } from '@/lib/database.types';
import { useDeleteEntry, useDeleteFundraiser, useFundraiserEntries, useFundraisers, useSetFundraiserStatus } from '@/lib/fundraisers';
import { formatMoney } from '@/lib/funds';
import { friendlyError } from '@/lib/supabase';

// One fundraiser. Members see the progress and their own pledge; the Pastor and elders also see who gave and pledged.
export default function FundraiserScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church_id } = useActiveChurch();
  const { canRunFundraisers } = usePermissions();
  const list = useFundraisers(church_id);
  const entries = useFundraiserEntries(id, church_id, canRunFundraisers);
  const setStatus = useSetFundraiserStatus(church_id);
  const remove = useDeleteFundraiser(church_id);
  const removeEntry = useDeleteEntry(church_id);

  const [editing, setEditing] = useState(false);
  const [receiving, setReceiving] = useState<FundraiserEntry | 'new' | null>(null);
  const [pledging, setPledging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (list.isPending) return <Loading />;
  const fundraiser = list.data?.find((f) => f.id === id);
  if (!fundraiser) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('fundraisers.gone')}</Body>
      </Screen>
    );
  }

  const active = fundraiser.status === 'active';
  const money = (n: number) => formatMoney(n, fundraiser.currency);
  const received = entries.data?.filter((e) => e.kind === 'received') ?? [];
  const pledges = entries.data?.filter((e) => e.kind === 'pledge') ?? [];

  function onDelete() {
    confirm(t('fundraisers.deleteTitle'), t('fundraisers.deleteMessage'), t('common.delete'), () =>
      remove.mutate(fundraiser!.id, { onSuccess: () => router.back(), onError: (e) => setError(friendlyError(e)) }),
    );
  }

  function onRemovePledge(entry: FundraiserEntry) {
    confirm(t('fundraisers.removePledgeTitle'), t('fundraisers.removePledgeMessage', { name: entry.party_name }), t('common.remove'), () =>
      removeEntry.mutate(entry.id, { onError: (e) => setError(friendlyError(e)) }),
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Heading>{fundraiser.title}</Heading>
        {fundraiser.description ? <Body>{fundraiser.description}</Body> : null}
        {!active ? <Body muted>{t('fundraisers.closedNote')}</Body> : null}
        <FundraiserProgress fundraiser={fundraiser} large />
      </Card>

      {active ? (
        <Card>
          <Heading>{t('fundraisers.yourPart')}</Heading>
          {fundraiser.my_pledge ? (
            <Body>{t('fundraisers.youPledged', { amount: money(fundraiser.my_pledge) })}</Body>
          ) : (
            <Body muted>{t('fundraisers.pledgePrompt')}</Body>
          )}
          <Button title={fundraiser.my_pledge ? t('fundraisers.changePledge') : t('fundraisers.pledge')} onPress={() => setPledging(true)} />
          <Body muted>{t('fundraisers.pledgeNote')}</Body>
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>

      {canRunFundraisers ? (
        <>
          {active ? <Button title={t('fundraisers.addReceived')} onPress={() => setReceiving('new')} /> : null}

          <Heading>{t('fundraisers.receivedHeading')}</Heading>
          <ErrorText>{entries.error ? friendlyError(entries.error) : null}</ErrorText>
          {entries.isPending ? <Loading /> : null}
          {entries.data && received.length === 0 ? <Body muted>{t('fundraisers.noReceived')}</Body> : null}
          {received.length > 0 ? (
            <Card>
              {received.map((e) => (
                <Row
                  key={e.id}
                  title={e.party_name || t('fundraisers.unnamed')}
                  subtitle={[formatDay(e.occurred_on), e.note || null].filter(Boolean).join(' · ')}
                  right={<Text style={[styles.amount, { color: theme.text }]}>{money(e.amount)}</Text>}
                  onPress={() => setReceiving(e)}
                />
              ))}
            </Card>
          ) : null}

          <Heading>{t('fundraisers.pledgesHeading')}</Heading>
          {entries.data && pledges.length === 0 ? <Body muted>{t('fundraisers.noPledges')}</Body> : null}
          {pledges.length > 0 ? (
            <Card>
              {pledges.map((e) => (
                <Row
                  key={e.id}
                  title={e.party_name}
                  subtitle={formatDay(e.occurred_on)}
                  right={<Text style={[styles.amount, { color: theme.text }]}>{money(e.amount)}</Text>}
                  onPress={() => onRemovePledge(e)}
                />
              ))}
            </Card>
          ) : null}
          <Body muted>{t('fundraisers.leaderNote')}</Body>

          <View style={styles.buttons}>
            <Button title={t('fundraisers.edit')} variant="secondary" onPress={() => setEditing(true)} style={styles.button} />
            <Button
              title={active ? t('fundraisers.close') : t('fundraisers.reopen')}
              variant="secondary"
              onPress={() => setStatus.mutate({ id: fundraiser.id, status: active ? 'closed' : 'active' }, { onError: (e) => setError(friendlyError(e)) })}
              loading={setStatus.isPending}
              style={styles.button}
            />
          </View>
          <Button title={t('fundraisers.delete')} variant="danger" onPress={onDelete} loading={remove.isPending} />
        </>
      ) : (
        <Body muted>{t('fundraisers.privacyNote')}</Body>
      )}

      {editing ? <FundraiserSheet existing={fundraiser} onClose={() => setEditing(false)} /> : null}
      {receiving ? (
        <ReceivedSheet
          key={receiving === 'new' ? 'new' : receiving.id}
          fundraiser={fundraiser}
          existing={receiving === 'new' ? null : receiving}
          onClose={() => setReceiving(null)}
        />
      ) : null}
      {pledging ? <PledgeSheet fundraiser={fundraiser} onClose={() => setPledging(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 16, fontWeight: 600 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1 },
});
