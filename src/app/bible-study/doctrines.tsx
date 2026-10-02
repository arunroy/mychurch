import { useTranslation } from 'react-i18next';

import { PassageSections } from '@/components/passage-sections';
import { DOCTRINE_SECTIONS } from '@/lib/study-references';

// What the New Testament teaches on the main Christian beliefs. Tap a passage to read it.
export default function DoctrinesScreen() {
  const { t } = useTranslation();
  return <PassageSections intro={t('study.doctrinesIntro')} sections={DOCTRINE_SECTIONS} />;
}
