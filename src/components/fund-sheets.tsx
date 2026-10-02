import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-time-fields';
import { Body, Button, Card, Chip, ErrorText, Heading, Row, TextField, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { dateKey, formatDay, isValidDateKey } from '@/lib/dates';
import type { FundTransactionWithPeople } from '@/lib/database.types';
import {
  formatMoney,
  fromCents,
  parseAmount,
  signedAmount,
  toCents,
  useAddTransaction,
  useDeleteTransaction,
  usePartyNames,
  useUpdateTransaction,
} from '@/lib/funds';
import { useMembers } from '@/lib/members';
import { friendlyError } from '@/lib/supabase';
import { useThemePreference } from '@/lib/theme-preference';
import { useUserId } from '@/lib/auth';

/** A bottom sheet with room for the keyboard. */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const { scheme } = useThemePreference();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={[styles.sheet, { backgroundColor: scheme === 'dark' ? '#000000' : '#F2F2F7' }]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
            <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
              <Body muted>{t('common.cancel')}</Body>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type Party = { name: string; userId: string | null };

const MAX_SUGGESTIONS = 8;

/**
 * Who the money came from (or was paid to): a church member picked from the list, a name used on an earlier entry,
 * or a new name typed in. Optional.
 */
export function PartyField({ kind, value, onChange }: { kind: 'in' | 'out'; value: Party; onChange: (next: Party) => void }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const members = useMembers(church_id);
  const before = usePartyNames(church_id);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!value.name);
  const label = kind === 'in' ? t('funds.receivedFrom') : t('funds.paidTo');

  function choose(next: Party) {
    onChange(next);
    setQuery('');
    setOpen(false);
  }

  if (value.name && !open) {
    return (
      <Card>
        <Body muted>{label}</Body>
        <Heading>{value.name}</Heading>
        {value.userId ? <Body muted>{t('funds.partyMember')}</Body> : null}
        <View style={styles.chips}>
          <Chip label={t('funds.partyChange')} onPress={() => setOpen(true)} />
          <Chip label={t('funds.partyClear')} onPress={() => onChange({ name: '', userId: null })} />
        </View>
      </Card>
    );
  }

  const q = query.trim().toLowerCase();
  const approved = (members.data ?? []).filter((m) => m.status === 'approved' && m.profile?.full_name);
  const matchingMembers = approved.filter((m) => !q || m.profile!.full_name.toLowerCase().includes(q));
  const matchingBefore = (before.data ?? []).filter((name) => !q || name.toLowerCase().includes(q));
  const exact =
    approved.some((m) => m.profile!.full_name.toLowerCase() === q) || (before.data ?? []).some((name) => name.toLowerCase() === q);

  return (
    <Card>
      <TextField
        label={label}
        value={query}
        onChangeText={setQuery}
        placeholder={t('funds.partyPlaceholder')}
        hint={t('funds.partyHint')}
        maxLength={100}
        autoCorrect={false}
      />
      {q && !exact ? <Row title={t('funds.useName', { name: query.trim() })} onPress={() => choose({ name: query.trim(), userId: null })} /> : null}
      {matchingMembers.length > 0 ? <Body muted>{t('funds.partyMembers')}</Body> : null}
      {matchingMembers.slice(0, MAX_SUGGESTIONS).map((m) => (
        <Row key={m.user_id} title={m.profile!.full_name} onPress={() => choose({ name: m.profile!.full_name, userId: m.user_id })} />
      ))}
      {matchingBefore.length > 0 ? <Body muted>{t('funds.partyBefore')}</Body> : null}
      {matchingBefore.slice(0, 5).map((name) => (
        <Row key={name} title={name} onPress={() => choose({ name, userId: null })} />
      ))}
      {matchingMembers.length > MAX_SUGGESTIONS ? <Body muted>{t('funds.partyMore')}</Body> : null}
      {value.name ? <Button title={t('common.cancel')} variant="secondary" onPress={() => setOpen(false)} /> : null}
    </Card>
  );
}

/** Adds a transaction, or with `existing` changes or deletes that one. */
export function FundTransactionSheet({
  existing,
  currency,
  onClose,
}: {
  existing: FundTransactionWithPeople | null;
  currency: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId()!;
  const add = useAddTransaction(church_id, userId);
  const update = useUpdateTransaction(church_id);
  const remove = useDeleteTransaction(church_id);

  const [kind, setKind] = useState<'in' | 'out'>(existing && existing.amount < 0 ? 'out' : 'in');
  const [amountText, setAmountText] = useState(existing ? String(Math.abs(existing.amount)) : '');
  const [date, setDate] = useState(existing?.occurred_on ?? dateKey());
  const [description, setDescription] = useState(existing?.description ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [party, setParty] = useState<Party>({ name: existing?.party_name ?? '', userId: existing?.party_user_id ?? null });
  const [error, setError] = useState<string | null>(null);

  const amount = parseAmount(amountText);
  const busy = add.isPending || update.isPending || remove.isPending;
  const valid = amount !== null && isValidDateKey(date) && description.trim() !== '';

  async function onSave() {
    if (amount === null) return;
    setError(null);
    const input = {
      occurred_on: date,
      description: description.trim(),
      note: note.trim(),
      amount: signedAmount(kind, amount),
      party_name: party.name.trim(),
      party_user_id: party.name.trim() ? party.userId : null,
    };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, input });
      else await add.mutateAsync(input);
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onDelete() {
    if (!existing) return;
    confirm(t('funds.deleteTitle'), t('funds.deleteMessage'), t('common.delete'), async () => {
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
      <Heading>{existing ? t('funds.editTitle') : t('funds.addTitle')}</Heading>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'in', label: t('funds.moneyIn') },
          { value: 'out', label: t('funds.moneyOut') },
        ]}
      />
      <TextField
        label={t('funds.amount', { currency })}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="2500.00"
        hint={amountText && amount === null ? t('funds.amountBad') : t('funds.amountHint')}
        autoFocus={!existing}
      />
      <DateField label={t('study.date')} value={date} onChange={setDate} hint={isValidDateKey(date) ? formatDay(date) : t('sermonEdit.chooseDate')} />
      <PartyField kind={kind} value={party} onChange={setParty} />
      <TextField
        label={t('funds.description')}
        value={description}
        onChangeText={setDescription}
        maxLength={200}
        placeholder={t('funds.descriptionPlaceholder')}
      />
      <TextField label={t('funds.note')} value={note} onChangeText={setNote} multiline maxLength={300} style={{ minHeight: 70, paddingTop: 12, textAlignVertical: 'top' }} />
      {existing ? (
        <Body muted>
          {existing.adder?.full_name ? t('funds.addedBy', { name: existing.adder.full_name }) : t('funds.addedByUnknown')}
          {existing.updated_at > existing.created_at && existing.editor?.full_name
            ? ` · ${t('funds.changedBy', { name: existing.editor.full_name })}`
            : ''}
        </Body>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button title={existing ? t('notes.saveChanges') : t('funds.addButton')} onPress={onSave} loading={add.isPending || update.isPending} disabled={!valid || busy} />
      {existing ? <Button title={t('common.delete')} variant="danger" onPress={onDelete} loading={remove.isPending} disabled={busy} /> : null}
    </Sheet>
  );
}

/**
 * The elder types what the bank shows. If it differs from the ledger, one "Balance adjustment" entry for the
 * difference is added, so the history stays complete instead of the number changing silently.
 */
export function CorrectBalanceSheet({ balance, currency, onClose }: { balance: number; currency: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId()!;
  const add = useAddTransaction(church_id, userId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A balance can be zero, which an amount cannot be, so zero is allowed here.
  const target = text.trim() === '0' ? 0 : parseAmount(text);
  const difference = target === null ? null : fromCents(toCents(target) - toCents(balance));

  async function onApply() {
    if (difference === null || difference === 0) return;
    setError(null);
    try {
      await add.mutateAsync({
        occurred_on: dateKey(),
        description: t('funds.adjustment'),
        note: '',
        amount: difference,
        party_name: '',
        party_user_id: null,
      });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Sheet onClose={onClose}>
      <Heading>{t('funds.correctTitle')}</Heading>
      <Body muted>{t('funds.correctIntro', { balance: formatMoney(balance, currency) })}</Body>
      <TextField
        label={t('funds.bankBalance', { currency })}
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        autoFocus
        hint={text && target === null ? t('funds.amountBad') : undefined}
      />
      {difference === 0 ? <Body>{t('funds.matches')}</Body> : null}
      {difference !== null && difference !== 0 ? (
        <Body>{t('funds.adjustmentPreview', { amount: formatMoney(difference, currency) })}</Body>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Button title={t('funds.addAdjustment')} onPress={onApply} loading={add.isPending} disabled={difference === null || difference === 0} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  content: { padding: Spacing.four, gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cancel: { alignItems: 'center', paddingVertical: Spacing.two },
});
