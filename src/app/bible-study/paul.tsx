import { useState } from 'react';

import { BookCard } from '@/components/book-card';
import { TranslationChips } from '@/components/passage-sections';
import { Body, Screen } from '@/components/ui';
import type { TranslationCode } from '@/lib/bible-books';
import { PAUL_LETTERS } from '@/lib/book-guide';

// The thirteen letters that carry Paul's name, in Bible order.
export default function PaulLettersScreen() {
  const [translation, setTranslation] = useState<TranslationCode>('web');
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Screen edges={['bottom']}>
      <Body muted>
        Thirteen letters from the apostle Paul. Dates are approximate. Tap a key verse to read it, or open the whole letter.
      </Body>
      <TranslationChips value={translation} onChange={setTranslation} />
      {PAUL_LETTERS.map((l) => (
        <BookCard
          key={l.book}
          book={l.book}
          facts={[
            { label: 'Written to', value: l.to },
            { label: 'Written from', value: l.writtenFrom },
            { label: 'Date', value: l.date },
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
