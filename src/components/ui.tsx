import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_ACCENT, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useChurch } from '@/lib/church';

/** The active church's colour, used for buttons and highlights. */
export function useAccent() {
  return useChurch().active?.church.accent_color ?? DEFAULT_ACCENT;
}

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const theme = useTheme();
  const inner = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor: theme.page }]}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.text }]}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.heading, { color: theme.text }]}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const theme = useTheme();
  return <Text style={[styles.body, { color: muted ? theme.textSecondary : theme.text }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const background =
    variant === 'primary' ? accent : variant === 'danger' ? theme.dangerBackground : theme.backgroundSelected;
  const color = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? theme.danger : theme.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.buttonText, { color }]}>{title}</Text>}
    </Pressable>
  );
}

export function TextField({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...props}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected },
          props.style,
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

export function Row({
  title,
  subtitle,
  left,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      {left}
      <View style={styles.rowText}>
        <Text style={[styles.body, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text> : null)}
    </Pressable>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const accent = useAccent();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          accessibilityLabel={title}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: accent }}
        />
      }
    />
  );
}

/** A round picture, or initials on a coloured background when there is none. */
export function Avatar({ name, uri, color, size = 40 }: { name: string; uri?: string | null; color?: string; size?: number }) {
  const theme = useTheme();
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={shape} contentFit="cover" accessibilityIgnoresInvertColors />;
  return (
    <View style={[shape, styles.avatar, { backgroundColor: color ?? theme.backgroundSelected }]}>
      <Text style={{ color: color ? '#FFFFFF' : theme.text, fontWeight: 600, fontSize: size * 0.4 }}>{initials}</Text>
    </View>
  );
}

/** A small rounded toggle, used for choices such as a translation or how long something shows. */
export function Chip({
  label,
  selected,
  onPress,
  wide,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  wide?: boolean;
}) {
  const theme = useTheme();
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        wide ? styles.chipWide : null,
        { backgroundColor: selected ? accent : theme.backgroundSelected, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={{ color: selected ? '#FFFFFF' : theme.text, fontSize: 15, fontWeight: selected ? 600 : 400 }}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.page }]}>
      <ActivityIndicator />
    </View>
  );
}

export function Gap({ size = Spacing.three }: { size?: number }) {
  return <View style={{ height: size }} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: 700 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: 600 },
  body: { fontSize: 16, lineHeight: 22 },
  error: { color: '#D92D20', fontSize: 15, lineHeight: 20 },
  button: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: 600 },
  field: { gap: Spacing.one },
  label: { fontSize: 15, fontWeight: 600 },
  input: { minHeight: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 17 },
  hint: { fontSize: 14, lineHeight: 19 },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two, minHeight: 48 },
  rowText: { flex: 1, gap: 2 },
  chevron: { fontSize: 24 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  chip: { minWidth: 44, minHeight: 40, borderRadius: 10, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  chipWide: { minWidth: 64 },
});
