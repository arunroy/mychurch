import { Screen } from '@/components/ui';
import { TodaysVerse } from '@/components/verse-card';

// Today's verse in full, opened from its row on Home.
export default function VerseScreen() {
  return (
    <Screen edges={['bottom']}>
      <TodaysVerse />
    </Screen>
  );
}
