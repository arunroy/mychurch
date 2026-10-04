import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Children, Fragment, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
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

import { ACCENT, IconColors, lighten, MaxContentWidth, Radius, Spacing, withAlpha } from '@/constants/theme';
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

/** Cards are flat, white sections on the grey page, as in the phone's Settings. */
export function useCardSurface(): ViewStyle {
  const theme = useTheme();
  return { backgroundColor: theme.backgroundElement };
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
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
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
            backgroundColor: theme.backgroundElement,
            borderColor: focused ? accent : 'transparent',
            borderWidth: 1.5,
            paddingHorizontal: Spacing.three - 1.5,
          },
          props.style,
        ]}
      />
      {hint ? <Text style={[styles.fieldHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

function isListRow(child: unknown): child is ReactElement<{ left?: ReactNode }> {
  return isValidElement(child) && (child.type === Row || child.type === ToggleRow);
}

/**
 * A white rounded section. When it holds only rows (optionally after a Heading), it becomes a grouped list: the
 * heading moves above the section as a small caption, and thin lines separate the rows, as in the phone's Settings.
 */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  const surface = useCardSurface();
  const items = Children.toArray(children);
  const first = items[0];
  const heading = isValidElement<{ children?: ReactNode }>(first) && first.type === Heading ? first : null;
  const rows = heading ? items.slice(1) : items;

  if (rows.length > 0 && rows.every(isListRow)) {
    return (
      <View style={styles.section}>
        {heading ? <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{heading.props.children}</Text> : null}
        <View style={[styles.sectionBody, { backgroundColor: theme.backgroundElement }, style]}>
          {rows.map((row, i) => (
            <Fragment key={row.key ?? i}>
              {i > 0 ? (
                <View style={[styles.separator, { backgroundColor: theme.hairline, marginLeft: row.props.left ? 54 : 0 }]} />
              ) : null}
              {row}
            </Fragment>
          ))}
        </View>
      </View>
    );
  }
  return <View style={[styles.card, surface, style]}>{children}</View>;
}

/** The phone-style switch between a few views or filters, such as Month, Week and Events. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const theme = useTheme();
  const { scheme } = useThemePreference();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected ? [styles.segmentSelected, { backgroundColor: scheme === 'dark' ? '#636366' : '#FFFFFF' }] : null,
            ]}>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: selected ? 600 : 500 }} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tick at the end of the chosen row in a list of choices. */
export function Checkmark({ visible = true }: { visible?: boolean }) {
  const accent = useAccentText();
  return <Ionicons name="checkmark" size={22} color={visible ? accent : 'transparent'} />;
}

export function Row({
  title,
  subtitle,
  left,
  right,
  onPress,
  onLongPress,
  chevron = true,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  /** A second action, such as opening a sermon's own screen to edit it. */
  onLongPress?: () => void;
  /** Off for rows that pick a choice rather than open something. */
  chevron?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      {left}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress && chevron ? <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} style={{ opacity: 0.6 }} /> : null}
    </Pressable>
  );
}

/**
 * A grouped list: an optional small heading, then the rows in one white section with thin lines between them.
 * `inset` moves the lines past an icon column, so they start under the text (44 for rows with an IconSquare).
 */
export function ListSection({
  title,
  footer,
  inset = 0,
  children,
}: {
  title?: string;
  footer?: string;
  inset?: number;
  children: ReactNode;
}) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <View style={styles.section}>
      {title ? <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text> : null}
      <View style={[styles.sectionBody, { backgroundColor: theme.backgroundElement }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.separator, { backgroundColor: theme.hairline, marginLeft: inset }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={[styles.sectionFooter, { color: theme.textSecondary }]}>{footer}</Text> : null}
    </View>
  );
}

/** The small coloured square with a white symbol at the start of a list row. */
export type IconName = keyof typeof Ionicons.glyphMap | { material: keyof typeof MaterialCommunityIcons.glyphMap };

export function IconSquare({ icon, color }: { icon: IconName; color: keyof typeof IconColors }) {
  return (
    <View style={[styles.iconSquare, { backgroundColor: IconColors[color] }]}>
      {typeof icon === 'string' ? (
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      ) : (
        <MaterialCommunityIcons name={icon.material} size={19} color="#FFFFFF" />
      )}
    </View>
  );
}

/** A red count in a pill, for unread or waiting items at the end of a row. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countBadgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

/** A thin line between rows inside a card. */
export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}

/** The green of an on switch, as on the phone's own settings. */
const SWITCH_ON = '#34C759';

export function ToggleRow({
  title,
  subtitle,
  left,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      left={left}
      right={
        <Switch
          accessibilityLabel={title}
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: SWITCH_ON, false: theme.backgroundSelected }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={theme.backgroundSelected}
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
  title: { fontSize: 34, lineHeight: 41, fontWeight: 700, letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: 400, letterSpacing: 0.2, textTransform: 'uppercase' },
  body: { fontSize: 17, lineHeight: 22 },
  error: { fontSize: 15, lineHeight: 20, fontWeight: 500 },
  button: {
    minHeight: 50,
    borderRadius: Radius.field,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: 600 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, lineHeight: 18, letterSpacing: 0.2, textTransform: 'uppercase', paddingHorizontal: 16 },
  fieldHint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
  input: { minHeight: 48, borderRadius: Radius.field, fontSize: 17 },
  hint: { fontSize: 14, lineHeight: 19 },
  card: { borderRadius: Radius.card, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, minHeight: 46 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, lineHeight: 22 },
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
  section: { gap: 6 },
  sectionTitle: { fontSize: 13, lineHeight: 18, letterSpacing: 0.2, textTransform: 'uppercase', paddingHorizontal: 16 },
  sectionBody: { borderRadius: Radius.card, paddingHorizontal: 16, overflow: 'hidden' },
  sectionFooter: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16 },
  separator: { height: StyleSheet.hairlineWidth },
  iconSquare: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: 700 },
  segmented: { flexDirection: 'row', borderRadius: 9, padding: 2 },
  segment: { flex: 1, minHeight: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentSelected: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
});
