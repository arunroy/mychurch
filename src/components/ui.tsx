import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
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

import { ACCENT, CardShadow, lighten, MaxContentWidth, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/lib/theme-preference';

/** Fills buttons and selected chips (white text on top): the app's one accent colour. */
export function useAccent() {
  return ACCENT;
}

/** The accent for text and icons on the page: as it is in light mode, lifted toward white in dark mode. */
export function useAccentText() {
  const accent = useAccent();
  const { scheme } = useThemePreference();
  return scheme === 'dark' ? lighten(accent, 0.45) : accent;
}

/** A soft tint of the accent, behind icons and the open tab. */
export function useAccentSoft() {
  const accent = useAccent();
  const { scheme } = useThemePreference();
  return withAlpha(accent, scheme === 'dark' ? 0.22 : 0.12);
}

/** Cards lift with a soft shadow in light mode and sit on a hairline outline in dark mode. */
export function useCardSurface(): ViewStyle {
  const theme = useTheme();
  const { scheme } = useThemePreference();
  return scheme === 'dark'
    ? { backgroundColor: theme.backgroundElement, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }
    : { backgroundColor: theme.backgroundElement, ...CardShadow };
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
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.heading, { color: theme.text }]}>{children}</Text>;
}

/** A small capitalised label above a section or card, like "VERSE OF THE DAY". */
export function Label({ children, accent }: { children: ReactNode; accent?: boolean }) {
  const theme = useTheme();
  const accentText = useAccentText();
  return <Text style={[styles.label, { color: accent ? accentText : theme.textSecondary }]}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const theme = useTheme();
  return <Text style={[styles.body, { color: muted ? theme.textSecondary : theme.text }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>
      {children}
    </Text>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** primary: the accent; secondary: outlined; tonal: a soft tint of the accent; danger: for deleting. */
  variant?: 'primary' | 'secondary' | 'tonal' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const theme = useTheme();
  const accent = useAccent();
  const accentText = useAccentText();
  const accentSoft = useAccentSoft();
  const look = {
    primary: { backgroundColor: accent, color: '#FFFFFF', borderColor: accent },
    secondary: { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
    tonal: { backgroundColor: accentSoft, color: accentText, borderColor: 'transparent' },
    danger: { backgroundColor: theme.dangerBackground, color: theme.danger, borderColor: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.backgroundColor, borderColor: look.borderColor, opacity: inactive ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={look.color} /> : <Text style={[styles.buttonText, { color: look.color }]}>{title}</Text>}
    </Pressable>
  );
}

export function TextField({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  const accent = useAccent();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.background,
            borderColor: focused ? accent : theme.border,
            borderWidth: focused ? 2 : 1,
            // Keeps the text still when the border thickens on focus.
            paddingHorizontal: focused ? Spacing.three - 1 : Spacing.three,
          },
          props.style,
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const surface = useCardSurface();
  return <View style={[styles.card, surface, style]}>{children}</View>;
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
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /> : null)}
    </Pressable>
  );
}

/** A thin line between rows inside a card. */
export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
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
  const theme = useTheme();
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
          trackColor={{ true: accent, false: theme.backgroundSelected }}
        />
      }
    />
  );
}

/** A round picture, or initials on a soft tint when there is none. */
export function Avatar({ name, uri, color, size = 40 }: { name: string; uri?: string | null; color?: string; size?: number }) {
  const theme = useTheme();
  const { scheme } = useThemePreference();
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={shape} contentFit="cover" accessibilityIgnoresInvertColors />;
  // With a colour, solid with white initials; otherwise a soft tint picked from the name, so people are easy to tell apart.
  const tint = color ? null : AVATAR_TINTS[hashName(name) % AVATAR_TINTS.length];
  const background = color ?? (scheme === 'dark' ? withAlpha(tint!, 0.25) : withAlpha(tint!, 0.14));
  const foreground = color ? '#FFFFFF' : scheme === 'dark' ? lighten(tint!, 0.45) : tint!;
  return (
    <View style={[shape, styles.avatar, { backgroundColor: background ?? theme.backgroundSelected }]}>
      <Text style={{ color: foreground, fontWeight: 700, fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

const AVATAR_TINTS = ['#2F4AC0', '#237A38', '#A61E4D', '#5F3DC4', '#A7380A', '#0B7285', '#7A5230'];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
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
        {
          backgroundColor: selected ? accent : theme.background,
          borderColor: selected ? accent : theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Text style={{ color: selected ? '#FFFFFF' : theme.text, fontSize: 15, fontWeight: 600 }}>{label}</Text>
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
    paddingHorizontal: 20,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: 700, letterSpacing: -0.4 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: 700, letterSpacing: -0.2 },
  label: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' },
  body: { fontSize: 16, lineHeight: 23 },
  error: { fontSize: 15, lineHeight: 20, fontWeight: 500 },
  button: {
    minHeight: 52,
    borderRadius: Radius.field,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: 600 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: 600 },
  input: { minHeight: 52, borderRadius: Radius.field, fontSize: 16 },
  hint: { fontSize: 14, lineHeight: 19 },
  card: { borderRadius: Radius.card, padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, minHeight: 52 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: 500 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    minWidth: 44,
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWide: { minWidth: 64 },
});
