import { useTranslation } from 'react-i18next';

import { Body, Card, ErrorText, Heading, Loading, Screen } from '@/components/ui';
import { WorshipPlanView } from '@/components/worship-plan-view';
import { useActiveChurch } from '@/lib/church';
import { formatDay } from '@/lib/dates';
import { friendlyError } from '@/lib/supabase';
import { useIsWorshipTime, useNextWorship } from '@/lib/worship';

// This Sunday's Psalm and songs, for everyone. Shown on Sunday until 6 PM. Planning is done in the Worship Planner.
export default function WorshipScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const next = useNextWorship(church_id);
  const worshipTime = useIsWorshipTime();

  if (next.isPending) return <Loading />;

  if (!worshipTime) {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <Heading>{t('worship.sundayOnlyTitle')}</Heading>
          <Body muted>{t('worship.sundayOnly')}</Body>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {next.error ? <ErrorText>{friendlyError(next.error)}</ErrorText> : null}
      {next.data ? (
        <Card>
          <Heading>{t('worship.thisSunday', { date: formatDay(next.data.service_date) })}</Heading>
          <WorshipPlanView plan={next.data} />
        </Card>
      ) : (
        <Card>
          <Heading>{t('worship.noneTitle')}</Heading>
          <Body muted>{t('worship.noneMember')}</Body>
        </Card>
      )}
    </Screen>
  );
}
