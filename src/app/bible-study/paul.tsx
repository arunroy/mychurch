import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BookCard } from '@/components/book-card';
import { TranslationChips, useStartVersion } from '@/components/passage-sections';
import { Body, Screen } from '@/components/ui';
import { PAUL_LETTERS } from '@/lib/book-guide';

// The thirteen letters that carry Paul's name, in Bible order.
export default function PaulLettersScreen() {
  const { t } = useTranslation();
  const [translation, setTranslation] = useStartVersion();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('study.paulIntro')}</Body>
      <TranslationChips value={translation} onChange={setTranslation} />
      {PAUL_LETTERS.map((l) => (
        <BookCard
          key={l.book}
          book={l.book}
          facts={[
            { label: t('study.writtenTo'), value: l.to },
            { label: t('study.writtenFrom'), value: l.writtenFrom },
            { label: t('study.date'), value: l.date },
          ]}
          theme={l.theme}
          keyVerse={l.keyVerse}
          translation={translation}
          open={open === l.book}
          onToggle={() => setOpen(open === l.book ? null : l.book)}
        />
      ))}
    </Screen>
  );
}
