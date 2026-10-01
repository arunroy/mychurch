import { PassageSections } from '@/components/passage-sections';
import { CHRIST_SECTIONS } from '@/lib/study-references';

// A quick reference to what the Bible says about Jesus. Tap a passage to read it.
export default function ChristReferenceScreen() {
  return <PassageSections intro="Passages about Jesus Christ. Tap one to read it." sections={CHRIST_SECTIONS} />;
}
