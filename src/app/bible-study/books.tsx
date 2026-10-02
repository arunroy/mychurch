import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BookCard } from '@/components/book-card';
import { TranslationChips, useStartVersion } from '@/components/passage-sections';
import { Body, Chip, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { BOOK_GROUPS, BOOK_GUIDE, type BookGroup } from '@/lib/book-guide';

// All 66 books, one group at a time.
export default function BooksOverviewScreen() {
  const [group, setGroup] = useState<BookGroup>('The Law');
  const { t } = useTranslation();
  const [translation, setTranslation] = useStartVersion();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('study.booksIntro')}</Body>
      <View style={styles.chips}>
        {BOOK_GROUPS.map((g) => (
          <Chip
            key={g}
            label={g}
            selected={g === group}
            onPress={() => {
              setGroup(g);
              setOpen(null);
            }}
          />
        ))}
      </View>
      <TranslationChips value={translation} onChange={setTranslation} />
      {BOOK_GUIDE.filter((b) => b.group === group).map((b) => (
        <BookCard
          key={b.book}
          book={b.book}
          facts={[{ label: t('study.author'), value: b.author }]}
          theme={b.theme}
          keyVerse={b.keyVerse}
          translation={translation}
          open={open === b.book}
          onToggle={() => setOpen(open === b.book ? null : b.book)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
