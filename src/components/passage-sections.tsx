import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Body, Card, Chip, Heading, Row, Screen } from '@/components/ui';
import { PassagePreview } from '@/components/verse-picker';
import { Spacing } from '@/constants/theme';
import { useLanguage } from '@/i18n/language-preference';
import { bookLabel } from '@/lib/bible-book-label';
import { formatReference } from '@/lib/bible-books';
import { defaultVersionFor, languageOf, versionsFor, type BibleVersionCode } from '@/lib/bible-versions';
import type { Reference, ReferenceSection } from '@/lib/study-references';

/** A reference like "John 3:16", with the book named in the given language. */
export function referenceText(r: Pick<Reference, 'book' | 'chapter' | 'verseStart' | 'verseEnd'>, language = 'en') {
  return formatReference(bookLabel(r.book, language), r.chapter, r.verseStart, r.verseEnd);
}

/** The Bible version choice shared by the study screens: the Bible language's own version, then the English ones. */
export function TranslationChips({ value, onChange }: { value: BibleVersionCode; onChange: (next: BibleVersionCode) => void }) {
  const { bibleLanguage } = useLanguage();
  return (
    <View style={styles.chips}>
      {versionsFor(bibleLanguage).map((v) => (
        <Chip key={v.code} label={v.short} wide selected={v.code === value} onPress={() => onChange(v.code)} />
      ))}
    </View>
  );
}

/** The version a study screen starts with, following the Bible language. */
export function useStartVersion() {
  const { bibleLanguage } = useLanguage();
  return useState<BibleVersionCode>(defaultVersionFor(bibleLanguage));
}

/** A reference that opens to show its text when tapped. */
export function ExpandablePassage({
  reference,
  translation,
  open,
  onToggle,
}: {
  reference: Reference;
  translation: BibleVersionCode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.item}>
      <Row title={referenceText(reference, languageOf(translation))} subtitle={reference.note} onPress={onToggle} />
      {open ? <PassagePreview passage={{ ...reference, translation }} /> : null}
    </View>
  );
}

/** A screen of titled groups of passages: pick a translation, tap a reference to read it. */
export function PassageSections({ intro, sections }: { intro: string; sections: ReferenceSection[] }) {
  const { t } = useTranslation();
  const { bibleLanguage } = useLanguage();
  const [translation, setTranslation] = useStartVersion();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen edges={['bottom']}>
      <Body muted>{intro}</Body>
      {bibleLanguage !== 'en' ? <Body muted>{t('study.englishOnly')}</Body> : null}
      <TranslationChips value={translation} onChange={setTranslation} />

      {sections.map((section) => (
        <Card key={section.title}>
          <Heading>{section.title}</Heading>
          <Body muted>{section.summary}</Body>
          {section.references.map((r) => {
            const key = `${section.title}|${referenceText(r)}`;
            // (the key stays English so it does not change when the language does)
            return (
              <ExpandablePassage
                key={key}
                reference={r}
                translation={translation}
                open={open === key}
                onToggle={() => setOpen(open === key ? null : key)}
              />
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  item: { gap: Spacing.two },
});
