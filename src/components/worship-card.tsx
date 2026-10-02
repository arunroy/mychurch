import { Body, Card, Heading } from '@/components/ui';
import { WorshipPlanView } from '@/components/worship-plan-view';
import { useActiveChurch } from '@/lib/church';
import { formatDay } from '@/lib/dates';
import { useTranslation } from 'react-i18next';
import { useIsWorshipTime, useNextWorship } from '@/lib/worship';

/** Home: this Sunday's Psalm and songs, on Sunday until 6 PM, and only when something is planned. Planning is in the Worship Planner. */
export function WorshipCard() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const next = useNextWorship(church_id);
  const worshipTime = useIsWorshipTime();

  if (!worshipTime || !next.data) return null;

  return (
    <Card>
      <Heading>{t('worship.cardTitle')}</Heading>
      <Body muted>{formatDay(next.data.service_date)}</Body>
      <WorshipPlanView plan={next.data} />
    </Card>
  );
}
