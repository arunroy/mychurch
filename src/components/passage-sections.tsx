import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Card, Chip, Heading, Row, Screen } from '@/components/ui';
import { PassagePreview } from '@/components/verse-picker';
import { Spacing } from '@/constants/theme';
import { displayBook, formatReference, TRANSLATIONS, type TranslationCode } from '@/lib/bible-books';
import type { Reference, ReferenceSection } from '@/lib/study-references';

export function referenceText(r: Pick<Reference, 'book' | 'chapter' | 'verseStart' | 'verseEnd'>) {
  return formatReference(displayBook(r.book), r.chapter, r.verseStart, r.verseEnd);
}

/** The translation choice shared by the study screens. */
export function TranslationChips({ value, onChange }: { value: TranslationCode; onChange: (next: TranslationCode) => void }) {
  return (
    <View style={styles.chips}>
      {TRANSLATIONS.map((t) => (
        <Chip key={t.code} label={t.short} wide selected={t.code === value} onPress={() => onChange(t.code)} />
      ))}
    </View>
  );
}

/** A reference that opens to show its text when tapped. */
export function ExpandablePassage({
  reference,
  translation,
  open,
  onToggle,
}: {
  reference: Reference;
  translation: TranslationCode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.item}>
      <Row title={referenceText(reference)} subtitle={reference.note} onPress={onToggle} />
      {open ? <PassagePreview passage={{ ...reference, translation }} /> : null}
    </View>
  );
}

/** A screen of titled groups of passages: pick a translation, tap a reference to read it. */
export function PassageSections({ intro, sections }: { intro: string; sections: ReferenceSection[] }) {
  const [translation, setTranslation] = useState<TranslationCode>('web');
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen edges={['bottom']}>
      <Body muted>{intro}</Body>
      <TranslationChips value={translation} onChange={setTranslation} />

      {sections.map((section) => (
        <Card key={section.title}>
          <Heading>{section.title}</Heading>
          <Body muted>{section.summary}</Body>
          {section.references.map((r) => {
            const key = `${section.title}|${referenceText(r)}`;
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
