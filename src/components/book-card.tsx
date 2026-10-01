import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ExpandablePassage } from '@/components/passage-sections';
import { Body, Button, Card, Heading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayBook, type TranslationCode } from '@/lib/bible-books';
import type { Reference } from '@/lib/study-references';

/** One book of the Bible: a few facts, its theme, a key verse that opens when tapped, and a way into the reader. */
export function BookCard({
  book,
  facts,
  theme: summary,
  keyVerse,
  translation,
  open,
  onToggle,
}: {
  book: string;
  facts: { label: string; value: string }[];
  theme: string;
  keyVerse: Reference;
  translation: TranslationCode;
  open: boolean;
  onToggle: () => void;
}) {
  const colors = useTheme();
  return (
    <Card>
      <Heading>{displayBook(book)}</Heading>
      <View style={styles.facts}>
        {facts.map((fact) => (
          <Text key={fact.label} style={[styles.fact, { color: colors.textSecondary }]}>
            <Text style={styles.label}>{fact.label}: </Text>
            {fact.value}
          </Text>
        ))}
      </View>
      <Body>{summary}</Body>
      <ExpandablePassage reference={keyVerse} translation={translation} open={open} onToggle={onToggle} />
      <Button
        title={`Read ${displayBook(book)}`}
        variant="secondary"
        onPress={() => router.push({ pathname: '/bible', params: { book, chapter: '1' } })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  facts: { gap: Spacing.one },
  fact: { fontSize: 14, lineHeight: 19 },
  label: { fontWeight: 600 },
});
