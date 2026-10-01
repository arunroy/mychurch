import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { DateFieldProps, TimeFieldProps } from '@/components/date-time-types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { combineDateTime, dateKey, formatDay, isValidDateKey, isValidTime, parseDateKey, timeText } from '@/lib/dates';

// Native date and time pickers: the phone's own dialog on Android, an inline picker on iPhone.
// The web version of this file uses the browser's date and time inputs.

function Box({ label, shown, placeholder, open, onPress, hint }: {
  label: string;
  shown: string;
  placeholder: string;
  open: boolean;
  onPress: () => void;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown || placeholder}`}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        style={[styles.box, { borderColor: open ? theme.text : theme.backgroundSelected, backgroundColor: theme.background }]}>
        <Text style={{ color: shown ? theme.text : theme.textSecondary, fontSize: 17 }}>{shown || placeholder}</Text>
      </Pressable>
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function DateField({ label, value, onChange, hint }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const current = isValidDateKey(value) ? parseDateKey(value) : new Date();

  function press() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onValueChange: (_event, date) => onChange(dateKey(date)),
      });
      return;
    }
    setOpen((o) => !o);
  }

  return (
    <View style={styles.wrap}>
      <Box
        label={label}
        shown={isValidDateKey(value) ? formatDay(value) : ''}
        placeholder="Choose a date"
        open={open}
        onPress={press}
        hint={hint}
      />
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker value={current} mode="date" display="inline" onValueChange={(_event, date) => onChange(dateKey(date))} />
      ) : null}
    </View>
  );
}

export function TimeField({ label, value, onChange, optional, hint }: TimeFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const valid = isValidTime(value);
  const current = valid ? combineDateTime(dateKey(), value) : combineDateTime(dateKey(), '09:00');

  function press() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'time',
        is24Hour: false,
        onValueChange: (_event, date) => onChange(timeText(date)),
      });
      return;
    }
    setOpen((o) => !o);
  }

  return (
    <View style={styles.wrap}>
      <Box
        label={label}
        shown={valid ? current.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''}
        placeholder={optional ? 'None' : 'Choose a time'}
        open={open}
        onPress={press}
        hint={hint}
      />
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker value={current} mode="time" display="spinner" onValueChange={(_event, date) => onChange(timeText(date))} />
      ) : null}
      {optional && valid ? (
        <Pressable accessibilityRole="button" onPress={() => onChange('')}>
          <Text style={{ color: theme.textSecondary, fontSize: 14, textDecorationLine: 'underline' }}>Clear {label.toLowerCase()}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  field: { gap: Spacing.one },
  label: { fontSize: 15, fontWeight: 600 },
  box: { minHeight: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: Spacing.three, justifyContent: 'center' },
  hint: { fontSize: 14, lineHeight: 19 },
});
