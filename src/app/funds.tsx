import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/date-time-fields';
import { CorrectBalanceSheet, FundTransactionSheet } from '@/components/fund-sheets';
import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Loading, Row, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { dateKey, formatDay, isValidDateKey } from '@/lib/dates';
import type { FundsSummary, FundTransactionWithPeople } from '@/lib/database.types';
import { CURRENCIES, formatMoney, parseAmount, useFundsSummary, useSaveFunds, useTransactions } from '@/lib/funds';
import { friendlyError } from '@/lib/supabase';

const IN = '#2E7D32';
const OUT = '#B3261E';
const PAGE = 50;

// The church's money, kept by hand by the Pastor and elders: the balance and the latest transactions.
// The database only lets the Pastor and elders in; the app shows nothing to anyone else.
export default function FundsScreen() {
  const { t } = useTranslation();
  const { canSeeFunds } = usePermissions();

  if (!canSeeFunds) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('funds.onlyLeaders')}</Body>
      </Screen>
    );
  }
  return <Funds />;
}

function Funds() {
  const { church_id } = useActiveChurch();
  const summary = useFundsSummary(church_id, true);
  const [editingSettings, setEditingSettings] = useState(false);

  if (summary.isPending) return <Loading />;
  if (summary.error) {
    return (
      <Screen edges={['bottom']}>
        <ErrorText>{friendlyError(summary.error)}</ErrorText>
      </Screen>
    );
  }
  if (!summary.data || editingSettings) {
    return <SettingsForm existing={summary.data ?? null} onDone={() => setEditingSettings(false)} />;
  }
  return <Ledger summary={summary.data} onSettings={() => setEditingSettings(true)} />;
}

/** First-time setup, and the settings afterwards: currency, the opening balance and an optional account note. */
function SettingsForm({ existing, onDone }: { existing: FundsSummary | null; onDone: () => void }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const save = useSaveFunds(church_id);
  const [currency, setCurrency] = useState(existing?.currency ?? 'INR');
  const [opening, setOpening] = useState(existing ? String(existing.opening_balance) : '');
  const [date, setDate] = useState(existing?.opening_date ?? dateKey());
  const [label, setLabel] = useState(existing?.account_label ?? '');
  const [error, setError] = useState<string | null>(null);

  // An opening balance can be zero.
  const balance = opening.trim() === '' || opening.trim() === '0' ? 0 : parseAmount(opening);
  const valid = balance !== null && isValidDateKey(date);

  async function onSave() {
    if (balance === null) return;
    setError(null);
    try {
      await save.mutateAsync({
        exists: !!existing,
        settings: { currency, opening_balance: balance, opening_date: date, account_label: label.trim() },
      });
      onDone();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Heading>{existing ? t('funds.settings') : t('funds.setupTitle')}</Heading>
        <Body muted>{t('funds.setupIntro')}</Body>
      </Card>

      <Card>
        <Body>{t('funds.currency')}</Body>
        <View style={styles.chips}>
          {CURRENCIES.map((c) => (
            <Chip key={c.code} label={`${c.symbol} ${c.code}`} selected={currency === c.code} onPress={() => setCurrency(c.code)} />
          ))}
        </View>
        <TextField
          label={t('funds.openingBalance', { currency })}
          value={opening}
          onChangeText={setOpening}
          keyboardType="decimal-pad"
          placeholder="0"
          hint={opening && balance === null ? t('funds.amountBad') : t('funds.openingHint')}
        />
        <DateField label={t('funds.openingDate')} value={date} onChange={setDate} hint={isValidDateKey(date) ? formatDay(date) : t('sermonEdit.chooseDate')} />
        <TextField label={t('funds.accountLabel')} value={label} onChangeText={setLabel} maxLength={60} placeholder="Federal Bank ••1234" hint={t('funds.accountHint')} />
        <ErrorText>{error}</ErrorText>
        <Button title={t('funds.saveSetup')} onPress={onSave} loading={save.isPending} disabled={!valid} />
        {existing ? <Button title={t('common.cancel')} variant="secondary" onPress={onDone} /> : null}
      </Card>
    </Screen>
  );
}

function Ledger({ summary, onSettings }: { summary: FundsSummary; onSettings: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { church_id } = useActiveChurch();
  const [showAll, setShowAll] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<FundTransactionWithPeople | 'new' | null>(null);
  const [correcting, setCorrecting] = useState(false);

  const transactions = useTransactions(church_id, showAll ? limit : 10, true);
  const list = transactions.data ?? [];

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Body muted>{t('funds.balanceTitle')}</Body>
        <Text style={[styles.balance, { color: summary.balance < 0 ? OUT : theme.text }]} accessibilityRole="header">
          {formatMoney(summary.balance, summary.currency)}
        </Text>
        <Body muted>
          {t('funds.asOf', { date: formatDay(summary.latest_on ?? summary.opening_date) })}
          {summary.account_label ? ` · ${summary.account_label}` : ''}
        </Body>
        <Button title={t('funds.addTransaction')} onPress={() => setEditing('new')} />
        <View style={styles.buttons}>
          <Button title={t('funds.correctBalance')} variant="secondary" onPress={() => setCorrecting(true)} style={styles.button} />
          <Button title={t('funds.settings')} variant="secondary" onPress={onSettings} style={styles.button} />
        </View>
      </Card>

      <Heading>{showAll ? t('funds.allTitle') : t('funds.recentTitle')}</Heading>
      <ErrorText>{transactions.error ? friendlyError(transactions.error) : null}</ErrorText>
      {transactions.isPending ? <Loading /> : null}
      {transactions.data && list.length === 0 ? <Body muted>{t('funds.none')}</Body> : null}

      {list.length > 0 ? (
        <Card>
          {list.map((entry) => {
            const money = entry.amount > 0;
            return (
              <Row
                key={entry.id}
                title={entry.description}
                subtitle={[
                  formatDay(entry.occurred_on),
                  entry.party_name ? (money ? t('funds.fromName', { name: entry.party_name }) : t('funds.toName', { name: entry.party_name })) : null,
                  entry.note || null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                right={
                  <View style={styles.amountBox}>
                    <Text style={[styles.amount, { color: money ? IN : OUT }]}>
                      {`${money ? '+' : '−'}${formatMoney(Math.abs(entry.amount), summary.currency)}`}
                    </Text>
                    <Text style={[styles.direction, { color: theme.textSecondary }]}>{money ? t('funds.in') : t('funds.out')}</Text>
                  </View>
                }
                onPress={() => setEditing(entry)}
              />
            );
          })}
        </Card>
      ) : null}

      {summary.transaction_count > 10 && !showAll ? (
        <Button title={t('funds.seeAll')} variant="secondary" onPress={() => setShowAll(true)} />
      ) : null}
      {showAll ? (
        <>
          {summary.transaction_count > limit ? (
            <Button title={t('funds.showMore')} variant="secondary" onPress={() => setLimit(limit + PAGE)} />
          ) : null}
          <Button
            title={t('funds.showFewer')}
            variant="secondary"
            onPress={() => {
              setShowAll(false);
              setLimit(PAGE);
            }}
          />
        </>
      ) : null}
      <Body muted>{t('funds.privacyNote')}</Body>
      <Gap />

      {editing ? (
        <FundTransactionSheet
          // A new key per entry so the form starts from that entry's own values.
          key={editing === 'new' ? 'new' : editing.id}
          existing={editing === 'new' ? null : editing}
          currency={summary.currency}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {correcting ? <CorrectBalanceSheet balance={summary.balance} currency={summary.currency} onClose={() => setCorrecting(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  balance: { fontSize: 36, fontWeight: 700 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1 },
  amountBox: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: 700 },
  direction: { fontSize: 12 },
});
