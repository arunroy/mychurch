import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { useAccent } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { SermonSource } from '@/lib/database.types';
import { siteName } from '@/lib/sermons';

/**
 * A small tag saying where a sermon comes from: the site it links to (SermonCentral, YouTube, ...) when it has a link,
 * otherwise whether it is the Pastor's or a member's own.
 */
export function SourceTag({ source, link }: { source: SermonSource; link?: string | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = useAccent();
  // A member's article is read in the app, so it keeps its Member tag even when it has a link alongside.
  const site = link && source !== 'member' ? siteName(link) : null;
  const tag = site ?? t(`sermons.tag${source[0].toUpperCase()}${source.slice(1)}`);
  const isPastor = !site && source === 'pastor';
  return (
    <Text
      accessibilityLabel={t('sermons.from', { tag })}
      numberOfLines={1}
      style={[
        styles.tag,
        {
          backgroundColor: isPastor ? accent : theme.backgroundSelected,
          color: isPastor ? '#FFFFFF' : theme.text,
        },
      ]}>
      {tag}
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
    alignSelf: 'center',
    maxWidth: 130,
  },
});
