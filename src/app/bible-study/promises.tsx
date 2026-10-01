import { PassageSections } from '@/components/passage-sections';
import { PROMISE_SECTIONS } from '@/lib/study-references';

// Passages to turn to in the hard and the ordinary moments of life.
export default function PromisesScreen() {
  return (
    <PassageSections
      intro="Where to turn when life is hard, and when it is good. Tap a passage to read it."
      sections={PROMISE_SECTIONS}
    />
  );
}
