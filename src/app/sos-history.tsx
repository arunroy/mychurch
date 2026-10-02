import { useTranslation } from 'react-i18next';

import { Body, Card, ErrorText, Heading, Loading, Row, Screen } from '@/components/ui';
import { useActiveChurch } from '@/lib/church';
import { getDateLocale } from '@/lib/dates';
import { useSosHistory } from '@/lib/sos';
import { friendlyError } from '@/lib/supabase';

/** For the Pastor and elders: who sent an alert, when, and how it ended, for the last 30 days. No locations are kept. */
export default function SosHistoryScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const history = useSosHistory(church_id, true);

  if (history.isPending) return <Loading />;

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('sos.historyNote')}</Body>
      {history.error ? <ErrorText>{friendlyError(history.error)}</ErrorText> : null}
      {history.data?.length === 0 ? (
        <Card>
          <Heading>{t('sos.historyEmpty')}</Heading>
        </Card>
      ) : (
        <Card>
          {history.data?.map((entry) => (
            <Row
              key={entry.id}
              title={entry.sender_name}
              subtitle={`${new Date(entry.started_at).toLocaleString(getDateLocale(), { dateStyle: 'medium', timeStyle: 'short' })} · ${t(`sos.status.${entry.status}`)}`}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
