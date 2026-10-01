import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField } from '@/components/ui';
import { useIsPlatformAdmin } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import type { ReportItem } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { reasonLabel, TARGET_LABELS, usePlatformReportQueue, useReportQueue, useResolveReport } from '@/lib/reports';
import { friendlyError } from '@/lib/supabase';

// Reports from members. Church leaders review reports about members and their content; the app's administrators
// review reports about the leaders themselves, so nobody reviews a report about themselves.
export default function ReportsScreen() {
  const { church_id, church } = useActiveChurch();
  const { isLeader } = usePermissions();
  const isPlatformAdmin = useIsPlatformAdmin().data === true;
  const churchQueue = useReportQueue(church_id, isLeader);
  const platformQueue = usePlatformReportQueue(isPlatformAdmin);

  if (!isLeader && !isPlatformAdmin) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>Only church leaders review reports.</Body>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {isLeader ? (
        <Section title={`Reports in ${church.name}`} queue={churchQueue} empty="No reports. If a member reports something, it shows up here." canOpen />
      ) : null}
      {isPlatformAdmin ? (
        <Section title="Reports about church leaders" queue={platformQueue} empty="No reports about church leaders." canOpen={false} />
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
  const open = queue.data?.filter((r) => r.status === 'open') ?? [];
  const closed = queue.data?.filter((r) => r.status !== 'open') ?? [];
  return (
    <>
      <Heading>{`${title}${open.length ? ` (${open.length} open)` : ''}`}</Heading>
      <ErrorText>{queue.error ? friendlyError(queue.error) : null}</ErrorText>
      {queue.isPending ? <Loading /> : null}
      {!queue.isPending && queue.data?.length === 0 ? <Body muted>{empty}</Body> : null}
      {open.map((report) => (
        <ReportCard key={report.id} report={report} canOpen={canOpen} />
      ))}
      {closed.length > 0 ? <Body muted>Closed</Body> : null}
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
      <Heading>{`${TARGET_LABELS[report.target_type]} · ${reasonLabel(report.reason)}`}</Heading>
      <Body muted>
        {[
          shortDate(report.created_at),
          report.reporter_name ? `reported by ${report.reporter_name}` : 'reported by a member',
          report.author_name ? `about ${report.author_name}` : null,
          report.church_name,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Body>
      {report.excerpt ? <Body>{`“${report.excerpt}”`}</Body> : null}
      {report.details ? <Body muted>{`Their note: ${report.details}`}</Body> : null}
      <ErrorText>{error}</ErrorText>

      {report.status !== 'open' ? (
        <Body muted>{`${report.status === 'resolved' ? 'Acted on' : 'No action needed'}${report.resolution_note ? `: ${report.resolution_note}` : ''}`}</Body>
      ) : (
        <>
          {open ? <Button title="Look at it" variant="secondary" onPress={open} /> : null}
          <TextField
            label="A note (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            style={{ minHeight: 60, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <Button title="I dealt with it" onPress={() => close(false)} loading={resolve.isPending} />
          <Button title="No action needed" variant="secondary" onPress={() => close(true)} loading={resolve.isPending} />
        </>
      )}
    </Card>
  );
}
