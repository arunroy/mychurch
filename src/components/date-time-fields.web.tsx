import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DateFieldProps, TimeFieldProps } from '@/components/date-time-types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay, isValidDateKey } from '@/lib/dates';

// Web date and time fields: the browser's own date and time inputs.

function WebInput({ label, type, value, onChange, hint }: {
  label: string;
  type: 'date' | 'time';
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      {createElement('input', {
        type,
        value,
        'aria-label': label,
        onChange: (event: { target: { value: string } }) => onChange(event.target.value),
        style: {
          minHeight: 50,
          borderRadius: 12,
          border: `1px solid ${theme.backgroundSelected}`,
          padding: '0 16px',
          fontSize: 17,
          color: theme.text,
          backgroundColor: theme.background,
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          colorScheme: 'normal',
        },
      })}
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function DateField({ label, value, onChange, hint }: DateFieldProps) {
  return (
    <WebInput
      label={label}
      type="date"
      value={isValidDateKey(value) ? value : ''}
      onChange={onChange}
      hint={hint ?? (isValidDateKey(value) ? formatDay(value) : undefined)}
    />
  );
}

export function TimeField({ label, value, onChange, hint }: TimeFieldProps) {
  return <WebInput label={label} type="time" value={value} onChange={onChange} hint={hint} />;
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  label: { fontSize: 15, fontWeight: 600 },
  hint: { fontSize: 14, lineHeight: 19 },
});
