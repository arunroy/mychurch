import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Loading, Row, Screen, TextField, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { SpecialDayEntry, SpecialDayKind } from '@/lib/database.types';
import {
  daysInMonth,
  formatMonthDay,
  useAddSpecialDay,
  useRemoveSpecialDay,
  useSpecialDays,
} from '@/lib/special-days';
import { friendlyError } from '@/lib/supabase';

// Leaders (Pastor, elders, admins) keep the church's list of birthdays and anniversaries.
export default function SpecialDaysScreen() {
  const { t } = useTranslation();
  const { isLeader } = usePermissions();
  if (!isLeader) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('specialDays.onlyLeaders')}</Body>
      </Screen>
    );
  }
  return <Manager />;
}

function Manager() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId()!;
  const days = useSpecialDays(church_id);
  const add = useAddSpecialDay(church_id, userId);
  const remove = useRemoveSpecialDay(church_id);
  const [kind, setKind] = useState<SpecialDayKind>('birthday');
  const [name, setName] = useState('');
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dayNumber = Number(day);
  const yearNumber = year.trim() ? Number(year) : null;
  const validDay = month !== null && Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= daysInMonth(month);
  const validYear = kind === 'birthday' || yearNumber === null || (Number.isInteger(yearNumber) && yearNumber >= 1900 && yearNumber <= 2100);

  async function onAdd() {
    if (month === null) return;
    setError(null);
    try {
      await add.mutateAsync({ kind, name: name.trim(), month, day: dayNumber, year: kind === 'anniversary' ? yearNumber : null });
      setName('');
      setDay('');
      setYear('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onRemove(entry: SpecialDayEntry) {
    confirm(t('specialDays.removeTitle'), t('specialDays.removeMessage', { name: entry.name }), t('common.remove'), async () => {
      try {
        await remove.mutateAsync(entry.id);
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  const added = (days.data ?? [])
    .filter((entry) => entry.source === 'added')
    .sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name));
  const own = (days.data ?? []).filter((entry) => entry.source === 'member').length;

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error ?? (days.error ? friendlyError(days.error) : null)}</ErrorText>

      <Card>
        <Heading>{t('specialDays.addTitle')}</Heading>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'birthday', label: t('specialDays.birthday') },
            { value: 'anniversary', label: t('specialDays.anniversary') },
          ]}
        />
        <TextField
          label={kind === 'birthday' ? t('specialDays.whoseBirthday') : t('specialDays.whoseAnniversary')}
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoCapitalize="words"
          placeholder={kind === 'birthday' ? t('specialDays.phBirthday') : t('specialDays.phAnniversary')}
        />
        <Body>{t('specialDays.month')}</Body>
        <View style={styles.chips}>
          {(t('months.short', { returnObjects: true }) as string[]).map((label, i) => (
            <Chip key={i} label={label} selected={month === i + 1} onPress={() => setMonth(i + 1)} />
          ))}
        </View>
        <TextField label={t('profile.day')} value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} placeholder="14" />
        {kind === 'anniversary' ? (
          <TextField
            label={t('specialDays.yearMarried')}
            hint={t('specialDays.yearHint')}
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1999"
          />
        ) : null}
        <Button title={t('specialDays.add')} onPress={onAdd} loading={add.isPending} disabled={!name.trim() || !validDay || !validYear} />
      </Card>

      <Card>
        <Heading>{t('specialDays.added')}</Heading>
        {days.isPending ? <Loading /> : null}
        {days.data && added.length === 0 ? <Body muted>{t('specialDays.none')}</Body> : null}
        {added.map((entry) => (
          <Row
            key={entry.id}
            title={entry.name}
            subtitle={`${entry.kind === 'birthday' ? t('specialDays.birthday') : t('specialDays.anniversary')} · ${formatMonthDay(entry.month, entry.day)}${entry.year ? `, ${entry.year}` : ''}`}
            right={<Button title={t('common.remove')} variant="danger" onPress={() => onRemove(entry)} />}
          />
        ))}
      </Card>

      <Body muted>
        {own === 0 ? t('specialDays.ownNone') : t('specialDays.own', { count: own })}
      </Body>
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
