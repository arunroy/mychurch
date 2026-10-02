import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-time-fields';
import { PartyField, Sheet, type Party } from '@/components/fund-sheets';
import { Body, Button, Chip, ErrorText, Heading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { dateKey, formatDay, isValidDateKey } from '@/lib/dates';
import type { FundraiserEntry, FundraiserSummary } from '@/lib/database.types';
import { useDeleteEntry, useSaveFundraiser, useSaveReceived, useSetPledge } from '@/lib/fundraisers';
import { CURRENCIES, parseAmount, useFundsSummary } from '@/lib/funds';
import { friendlyError } from '@/lib/supabase';

/** Opens a fundraiser, or with `existing` changes it. The target is optional. */
export function FundraiserSheet({ existing, onClose }: { existing: FundraiserSummary | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { canSeeFunds } = usePermissions();
  const userId = useUserId()!;
  const funds = useFundsSummary(church_id, canSeeFunds);
  const save = useSaveFundraiser(church_id, userId);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [currency, setCurrency] = useState(existing?.currency ?? funds.data?.currency ?? 'INR');
  const [targetText, setTargetText] = useState(existing?.target_amount ? String(existing.target_amount) : '');
  const [error, setError] = useState<string | null>(null);

  const target = targetText.trim() === '' ? null : parseAmount(targetText);
  const targetBad = targetText.trim() !== '' && target === null;
  const valid = title.trim() !== '' && !targetBad;

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id ?? null,
        input: { title: title.trim(), description: description.trim(), target_amount: target, currency },
      });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Sheet onClose={onClose}>
      <Heading>{existing ? t('fundraisers.editTitle') : t('fundraisers.newTitle')}</Heading>
      <TextField
        label={t('fundraisers.titleLabel')}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        placeholder={t('fundraisers.titlePlaceholder')}
        autoFocus={!existing}
      />
      <TextField
        label={t('fundraisers.descriptionLabel')}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
        style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <Body>{t('funds.currency')}</Body>
      <View style={styles.chips}>
        {CURRENCIES.map((c) => (
          <Chip key={c.code} label={`${c.symbol} ${c.code}`} selected={currency === c.code} onPress={() => setCurrency(c.code)} />
        ))}
      </View>
      <TextField
        label={t('fundraisers.targetLabel', { currency })}
        value={targetText}
        onChangeText={setTargetText}
        keyboardType="decimal-pad"
        placeholder="1000000"
        hint={targetBad ? t('funds.amountBad') : t('fundraisers.targetHint')}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={existing ? t('notes.saveChanges') : t('fundraisers.open')} onPress={onSave} loading={save.isPending} disabled={!valid} />
    </Sheet>
  );
}

/** Records money that came in for a fundraiser, or with `existing` changes or deletes that entry. Who gave is optional. */
export function ReceivedSheet({
  fundraiser,
  existing,
  onClose,
}: {
  fundraiser: FundraiserSummary;
  existing: FundraiserEntry | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId()!;
  const save = useSaveReceived(church_id, fundraiser.id, userId);
  const remove = useDeleteEntry(church_id);

  const [amountText, setAmountText] = useState(existing ? String(existing.amount) : '');
  const [date, setDate] = useState(existing?.occurred_on ?? dateKey());
  const [note, setNote] = useState(existing?.note ?? '');
  const [party, setParty] = useState<Party>({ name: existing?.party_name ?? '', userId: existing?.party_user_id ?? null });
  const [error, setError] = useState<string | null>(null);

  const amount = parseAmount(amountText);
  const busy = save.isPending || remove.isPending;
  const valid = amount !== null && isValidDateKey(date);

  async function onSave() {
    if (amount === null) return;
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id ?? null,
        input: {
          amount,
          occurred_on: date,
          note: note.trim(),
          party_name: party.name.trim(),
          party_user_id: party.name.trim() ? party.userId : null,
        },
      });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onDelete() {
    if (!existing) return;
    confirm(t('fundraisers.deleteEntryTitle'), t('fundraisers.deleteEntryMessage'), t('common.delete'), async () => {
      try {
        await remove.mutateAsync(existing.id);
        onClose();
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  return (
    <Sheet onClose={onClose}>
      <Heading>{existing ? t('fundraisers.editReceived') : t('fundraisers.addReceived')}</Heading>
      <TextField
        label={t('funds.amount', { currency: fundraiser.currency })}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="5000"
        hint={amountText && amount === null ? t('funds.amountBad') : t('funds.amountHint')}
        autoFocus={!existing}
      />
      <DateField label={t('study.date')} value={date} onChange={setDate} hint={isValidDateKey(date) ? formatDay(date) : t('sermonEdit.chooseDate')} />
      <PartyField kind="in" value={party} onChange={setParty} />
      <TextField label={t('funds.note')} value={note} onChangeText={setNote} multiline maxLength={300} style={{ minHeight: 70, paddingTop: 12, textAlignVertical: 'top' }} />
      <ErrorText>{error}</ErrorText>
      <Button title={existing ? t('notes.saveChanges') : t('funds.addButton')} onPress={onSave} loading={save.isPending} disabled={!valid || busy} />
      {existing ? <Button title={t('common.delete')} variant="danger" onPress={onDelete} loading={remove.isPending} disabled={busy} /> : null}
    </Sheet>
  );
}

/** A member says how much they can give, or changes or takes back what they said. */
export function PledgeSheet({ fundraiser, onClose }: { fundraiser: FundraiserSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const pledge = useSetPledge(church_id);
  const [amountText, setAmountText] = useState(fundraiser.my_pledge ? String(fundraiser.my_pledge) : '');
  const [error, setError] = useState<string | null>(null);
  const amount = parseAmount(amountText);

  async function submit(value: number) {
    setError(null);
    try {
      await pledge.mutateAsync({ fundraiserId: fundraiser.id, amount: value });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Sheet onClose={onClose}>
      <Heading>{t('fundraisers.pledgeTitle')}</Heading>
      <Body muted>{t('fundraisers.pledgeIntro', { title: fundraiser.title })}</Body>
      <TextField
        label={t('funds.amount', { currency: fundraiser.currency })}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="1000"
        hint={amountText && amount === null ? t('funds.amountBad') : t('fundraisers.pledgeHint')}
        autoFocus
      />
      <ErrorText>{error}</ErrorText>
      <Button title={t('fundraisers.pledgeSave')} onPress={() => amount !== null && submit(amount)} loading={pledge.isPending} disabled={amount === null} />
      {fundraiser.my_pledge ? (
        <Button title={t('fundraisers.pledgeTakeBack')} variant="secondary" onPress={() => submit(0)} disabled={pledge.isPending} />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
