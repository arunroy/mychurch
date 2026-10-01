import { PassageSections } from '@/components/passage-sections';
import { DOCTRINE_SECTIONS } from '@/lib/study-references';

// What the New Testament teaches on the main Christian beliefs. Tap a passage to read it.
export default function DoctrinesScreen() {
  return (
    <PassageSections
      intro="The main Christian beliefs, each with the passages that teach it. Tap one to read it."
      sections={DOCTRINE_SECTIONS}
    />
  );
}
