import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Chip, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { lookUpPassage, type Passage } from '@/lib/bible';
import { BIBLE_BOOKS, findBook, TRANSLATIONS, type TranslationCode } from '@/lib/bible-books';

/** What the Pastor has chosen so far. `book` stays empty until they pick one. */
export type PassageDraft = {
  translation: TranslationCode;
  book: string | null;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

/** The complete passage, once a book is chosen. The daily verse is always one of the English translations. */
export function toPassage(draft: PassageDraft): (Passage & { translation: TranslationCode }) | null {
  return draft.book ? { ...draft, book: draft.book } : null;
}

type Panel = 'book' | 'chapter' | 'start' | 'end' | null;

/** A labelled box that shows the current choice and opens its list when tapped. */
function Selector({ label, value, open, onPress }: { label: string; value: string; open: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.selector}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        style={[styles.selectorBox, { borderColor: open ? theme.text : theme.backgroundSelected, backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text, fontSize: 17 }} numberOfLines={1}>
          {value}
        </Text>
      </Pressable>
    </View>
  );
}

function NumberGrid({ from, to, selected, onPick }: { from: number; to: number; selected: number; onPick: (n: number) => void }) {
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <View style={styles.grid}>
      {numbers.map((n) => (
        <Chip key={n} label={String(n)} selected={n === selected} onPress={() => onPick(n)} />
      ))}
    </View>
  );
}

/**
 * Pick a translation, book, chapter and verses. There is nowhere to type or paste verse text:
 * the only text field filters the book list. Pass `showTranslation={false}` where only the passage
 * matters, such as naming a sermon's scripture.
 */
export function VersePicker({
  value,
  onChange,
  showTranslation = true,
}: {
  value: PassageDraft;
  onChange: (next: PassageDraft) => void;
  showTranslation?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [panel, setPanel] = useState<Panel>(null);
  const [filter, setFilter] = useState('');
  const book = value.book ? findBook(value.book) : undefined;
  const verseCount = book?.verses[value.chapter - 1] ?? 1;

  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));
  const books = BIBLE_BOOKS.filter((b) => b.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <View style={styles.wrap}>
      {showTranslation ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text }]}>{t('picker.translation')}</Text>
          <View style={styles.grid}>
            {TRANSLATIONS.map((tr) => (
              <Chip
                key={tr.code}
                label={tr.short}
                wide
                selected={tr.code === value.translation}
                onPress={() => onChange({ ...value, translation: tr.code })}
              />
            ))}
          </View>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {t('picker.publicDomain', { name: TRANSLATIONS.find((tr) => tr.code === value.translation)?.name })}
          </Text>
        </View>
      ) : null}

      <Selector label={t('picker.book')} value={value.book ?? t('picker.chooseBook')} open={panel === 'book'} onPress={() => toggle('book')} />
      {panel === 'book' ? (
        <View style={styles.panel}>
          <TextField
            label={t('bible.findBook')}
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('bible.findBookPlaceholder')}
          />
          <View style={styles.grid}>
            {books.map((b) => (
              <Chip
                key={b.name}
                label={b.name}
                selected={b.name === value.book}
                onPress={() => {
                  onChange({ ...value, book: b.name, chapter: 1, verseStart: 1, verseEnd: 1 });
                  setFilter('');
                  setPanel('chapter');
                }}
              />
            ))}
            {books.length === 0 ? <Body muted>{t('bible.noBook')}</Body> : null}
          </View>
        </View>
      ) : null}

      {book ? (
        <>
          <View style={styles.selectors}>
            <Selector label={t('picker.chapter')} value={String(value.chapter)} open={panel === 'chapter'} onPress={() => toggle('chapter')} />
            <Selector label={t('picker.fromVerse')} value={String(value.verseStart)} open={panel === 'start'} onPress={() => toggle('start')} />
            <Selector label={t('picker.toVerse')} value={String(value.verseEnd)} open={panel === 'end'} onPress={() => toggle('end')} />
          </View>

          {panel === 'chapter' ? (
            <NumberGrid
              from={1}
              to={book.verses.length}
              selected={value.chapter}
              onPick={(chapter) => {
                onChange({ ...value, chapter, verseStart: 1, verseEnd: 1 });
                setPanel('start');
              }}
            />
          ) : null}
          {panel === 'start' ? (
            <NumberGrid
              from={1}
              to={verseCount}
              selected={value.verseStart}
              onPick={(verseStart) => {
                onChange({ ...value, verseStart, verseEnd: Math.max(value.verseEnd, verseStart) });
                setPanel('end');
              }}
            />
          ) : null}
          {panel === 'end' ? (
            <NumberGrid
              from={value.verseStart}
              to={verseCount}
              selected={value.verseEnd}
              onPick={(verseEnd) => {
                onChange({ ...value, verseEnd });
                setPanel(null);
              }}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Read-only text of the chosen passage. Loads as the Pastor picks; the server stores its own copy. */
export function usePassagePreview(passage: Passage | null) {
  return useQuery({
    queryKey: ['verse-preview', passage],
    enabled: !!passage,
    staleTime: Infinity,
    retry: false,
    queryFn: ({ signal }) => lookUpPassage(passage!, signal),
  });
}

export function PassagePreview({ passage }: { passage: Passage | null }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const preview = usePassagePreview(passage);
  if (!passage) return <Body muted>{t('picker.seeVerse')}</Body>;
  if (preview.isPending) return <ActivityIndicator />;
  if (preview.isError) return <Body>{preview.error.message}</Body>;
  return (
    <View style={[styles.preview, { borderColor: theme.backgroundSelected }]}>
      <Text style={[styles.reference, { color: theme.text }]}>{preview.data.reference}</Text>
      <Text style={[styles.verse, { color: theme.text }]}>
        {preview.data.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  field: { gap: Spacing.two },
  label: { fontSize: 15, fontWeight: 600 },
  hint: { fontSize: 14, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  selectors: { flexDirection: 'row', gap: Spacing.two },
  selector: { flex: 1, gap: Spacing.one },
  selectorBox: { minHeight: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: Spacing.three, justifyContent: 'center' },
  panel: { gap: Spacing.two },
  preview: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  reference: { fontSize: 17, fontWeight: 600 },
  verse: { fontSize: 17, lineHeight: 25 },
});
