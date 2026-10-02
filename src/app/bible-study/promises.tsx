import { useTranslation } from 'react-i18next';

import { PassageSections } from '@/components/passage-sections';
import { PROMISE_SECTIONS } from '@/lib/study-references';

// Passages to turn to in the hard and the ordinary moments of life.
export default function PromisesScreen() {
  const { t } = useTranslation();
  return <PassageSections intro={t('study.promisesIntro')} sections={PROMISE_SECTIONS} />;
}
