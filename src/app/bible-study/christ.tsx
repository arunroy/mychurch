import { useTranslation } from 'react-i18next';

import { PassageSections } from '@/components/passage-sections';
import { CHRIST_SECTIONS } from '@/lib/study-references';

// A quick reference to what the Bible says about Jesus. Tap a passage to read it.
export default function ChristReferenceScreen() {
  const { t } = useTranslation();
  return <PassageSections intro={t('study.christIntro')} sections={CHRIST_SECTIONS} />;
}
