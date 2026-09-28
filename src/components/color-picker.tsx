import { Pressable, StyleSheet, View } from 'react-native';

import { ACCENT_CHOICES, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {ACCENT_CHOICES.map((color) => {
        const selected = color.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={color}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Colour ${color}`}
            onPress={() => onChange(color)}
            style={[styles.swatch, { backgroundColor: color, borderColor: selected ? theme.text : 'transparent' }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
});
