import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField } from '@/components/ui';
import { useIsPlatformAdmin } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import type { ReportItem } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { usePlatformReportQueue, useReportQueue, useResolveReport } from '@/lib/reports';
import { friendlyError } from '@/lib/supabase';

// Reports from members. Church leaders review reports about members and their content; the app's administrators
// review reports about the leaders themselves, so nobody reviews a report about themselves.
export default function ReportsScreen() {
  const { t } = useTranslation();
  const { church_id, church } = useActiveChurch();
  const { isLeader } = usePermissions();
  const isPlatformAdmin = useIsPlatformAdmin().data === true;
  const churchQueue = useReportQueue(church_id, isLeader);
  const platformQueue = usePlatformReportQueue(isPlatformAdmin);

  if (!isLeader && !isPlatformAdmin) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('reports.onlyLeaders')}</Body>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {isLeader ? (
        <Section title={t('reports.inChurch', { church: church.name })} queue={churchQueue} empty={t('reports.emptyChurch')} canOpen />
      ) : null}
      {isPlatformAdmin ? (
        <Section title={t('reports.aboutLeaders')} queue={platformQueue} empty={t('reports.emptyLeaders')} canOpen={false} />
      ) : null}
      <Gap />
    </Screen>
  );
}

function Section({
  title,
  queue,
  empty,
  canOpen,
}: {
  title: string;
  queue: { data?: ReportItem[]; isPending: boolean; error: unknown };
  empty: string;
  canOpen: boolean;
}) {
  const { t } = useTranslation();
  const open = queue.data?.filter((r) => r.status === 'open') ?? [];
  const closed = queue.data?.filter((r) => r.status !== 'open') ?? [];
  return (
    <>
      <Heading>{open.length ? t('reports.withOpen', { title, count: open.length }) : title}</Heading>
      <ErrorText>{queue.error ? friendlyError(queue.error) : null}</ErrorText>
      {queue.isPending ? <Loading /> : null}
      {!queue.isPending && queue.data?.length === 0 ? <Body muted>{empty}</Body> : null}
      {open.map((report) => (
        <ReportCard key={report.id} report={report} canOpen={canOpen} />
      ))}
      {closed.length > 0 ? <Body muted>{t('reports.closed')}</Body> : null}
      {closed.map((report) => (
        <ReportCard key={report.id} report={report} canOpen={false} />
      ))}
    </>
  );
}

/** Where a reviewer can look at the reported thing. Private messages stay private, so they have no link. */
function openTarget(report: ReportItem) {
  switch (report.target_type) {
    case 'chat_message':
      return () => router.push('/chat');
    case 'prayer_request':
      return () => router.push('/prayer');
    case 'question':
      return () => router.push('/qa');
    case 'poll':
      return () => router.push('/polls');
    case 'sermon':
      return () => router.push({ pathname: '/sermon/[id]', params: { id: report.target_id } });
    case 'event':
      return () => router.push({ pathname: '/event/[id]', params: { id: report.target_id } });
    case 'member':
      return () => router.push({ pathname: '/member/[id]', params: { id: report.target_id } });
    default:
      return null;
  }
}

function ReportCard({ report, canOpen }: { report: ReportItem; canOpen: boolean }) {
  const { t } = useTranslation();
  const resolve = useResolveReport();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const open = canOpen ? openTarget(report) : null;

  async function close(dismiss: boolean) {
    setError(null);
    try {
      await resolve.mutateAsync({ id: report.id, dismiss, note: note.trim() || undefined });
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Card>
      <Heading>{`${t(`reports.target${report.target_type[0].toUpperCase()}${report.target_type.slice(1)}`)} · ${t(`reports.reason${report.reason[0].toUpperCase()}${report.reason.slice(1)}`)}`}</Heading>
      <Body muted>
        {[
          shortDate(report.created_at),
          report.reporter_name ? t('reports.reportedBy', { name: report.reporter_name }) : t('reports.reportedByMember'),
          report.author_name ? t('reports.about', { name: report.author_name }) : null,
          report.church_name,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Body>
      {report.excerpt ? <Body>{`“${report.excerpt}”`}</Body> : null}
      {report.details ? <Body muted>{t('reports.theirNote', { details: report.details })}</Body> : null}
      <ErrorText>{error}</ErrorText>

      {report.status !== 'open' ? (
        <Body muted>
          {report.resolution_note
            ? t('reports.withNote', { status: report.status === 'resolved' ? t('reports.actedOn') : t('reports.noAction'), note: report.resolution_note })
            : report.status === 'resolved'
              ? t('reports.actedOn')
              : t('reports.noAction')}
        </Body>
      ) : (
        <>
          {open ? <Button title={t('reports.lookAt')} variant="secondary" onPress={open} /> : null}
          <TextField
            label={t('reports.note')}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            style={{ minHeight: 60, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <Button title={t('reports.dealt')} onPress={() => close(false)} loading={resolve.isPending} />
          <Button title={t('reports.noAction')} variant="secondary" onPress={() => close(true)} loading={resolve.isPending} />
        </>
      )}
    </Card>
  );
}
