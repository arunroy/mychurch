import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Loading, Row, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { SpecialDayEntry, SpecialDayKind } from '@/lib/database.types';
import {
  daysInMonth,
  formatMonthDay,
  MONTHS,
  useAddSpecialDay,
  useRemoveSpecialDay,
  useSpecialDays,
} from '@/lib/special-days';
import { friendlyError } from '@/lib/supabase';

// Leaders (Pastor, elders, admins) keep the church's list of birthdays and anniversaries.
export default function SpecialDaysScreen() {
  const { isLeader } = usePermissions();
  if (!isLeader) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>Only the Pastor, elders and church admins can change birthdays and anniversaries.</Body>
      </Screen>
    );
  }
  return <Manager />;
}

function Manager() {
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
    confirm('Remove this date?', `${entry.name}'s ${entry.kind} will disappear from everyone's Home screen.`, 'Remove', async () => {
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
        <Heading>Add a date</Heading>
        <View style={styles.chips}>
          <Chip label="Birthday" selected={kind === 'birthday'} onPress={() => setKind('birthday')} />
          <Chip label="Anniversary" selected={kind === 'anniversary'} onPress={() => setKind('anniversary')} />
        </View>
        <TextField
          label={kind === 'birthday' ? 'Whose birthday' : 'Whose anniversary'}
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoCapitalize="words"
          placeholder={kind === 'birthday' ? 'Mary Okafor' : 'John and Ruth Mensah'}
        />
        <Body>Month</Body>
        <View style={styles.chips}>
          {MONTHS.map((label, i) => (
            <Chip key={label} label={label.slice(0, 3)} selected={month === i + 1} onPress={() => setMonth(i + 1)} />
          ))}
        </View>
        <TextField label="Day" value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} placeholder="14" />
        {kind === 'anniversary' ? (
          <TextField
            label="Year married (optional)"
            hint="Lets Home say how many years."
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1999"
          />
        ) : null}
        <Button title="Add" onPress={onAdd} loading={add.isPending} disabled={!name.trim() || !validDay || !validYear} />
      </Card>

      <Card>
        <Heading>Dates you added</Heading>
        {days.isPending ? <Loading /> : null}
        {days.data && added.length === 0 ? <Body muted>Nothing added yet.</Body> : null}
        {added.map((entry) => (
          <Row
            key={entry.id}
            title={entry.name}
            subtitle={`${entry.kind === 'birthday' ? 'Birthday' : 'Anniversary'} · ${formatMonthDay(entry.month, entry.day)}${entry.year ? `, ${entry.year}` : ''}`}
            right={<Button title="Remove" variant="danger" onPress={() => onRemove(entry)} />}
          />
        ))}
      </Card>

      <Body muted>
        {own === 0
          ? 'Members can add their own birthday in their profile settings. Those show here for everyone too.'
          : `${own === 1 ? '1 member has' : `${own} members have`} added their own birthday in their profile settings. Only they can change it.`}
      </Body>
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
