import { StyleSheet, Text } from 'react-native';

import { useAccent } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { SermonSource } from '@/lib/database.types';
import { sourceTag } from '@/lib/sermons';

/** A small tag saying whether a sermon is the Pastor's, a member's, or from outside the church. */
export function SourceTag({ source }: { source: SermonSource }) {
  const theme = useTheme();
  const accent = useAccent();
  const isPastor = source === 'pastor';
  return (
    <Text
      accessibilityLabel={`From ${sourceTag(source)}`}
      style={[
        styles.tag,
        {
          backgroundColor: isPastor ? accent : theme.backgroundSelected,
          color: isPastor ? '#FFFFFF' : theme.text,
        },
      ]}>
      {sourceTag(source)}
    </Text>
  );
}

const styles = StyleSheet.create({
  tag: {
    fontSize: 12,
    fontWeight: 700,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
});
