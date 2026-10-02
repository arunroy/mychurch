import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Body, Button, Card, ErrorText, Heading, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { messageTime } from '@/lib/dates';
import { startConversation } from '@/lib/messages';
import { callEmergency, openInMaps, useActiveSosAlerts, useEndSos } from '@/lib/sos';
import { friendlyError, publicUrl } from '@/lib/supabase';

const SOS_RED = '#D92D20';

/** One open alert: who, when, and where they are now. Live; once the alert ends this says so and the location is gone. */
export default function SosAlertScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church } = useActiveChurch();
  const userId = useUserId();
  const { isLeader } = usePermissions();
  const alerts = useActiveSosAlerts(church.id);
  const end = useEndSos(church.id);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  if (alerts.isPending) return <Loading />;
  const alert = alerts.data?.find((a) => a.id === id);

  if (!alert) {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <Heading>{t('sos.ended')}</Heading>
          <Body muted>{t('sos.endedBody')}</Body>
        </Card>
        <Button title={t('common.close')} variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Screen>
    );
  }

  const isMine = alert.sender_id === userId;
  const age = alert.location_at ? Math.max(0, Math.round((now - new Date(alert.location_at).getTime()) / 1000)) : null;

  async function messageSender() {
    setOpening(true);
    setError(null);
    try {
      const conversationId = await startConversation(church.id, alert!.sender_id);
      router.push({ pathname: '/chat/[id]', params: { id: conversationId, name: alert!.sender_name } });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setOpening(false);
    }
  }

  function endAlert() {
    confirm(t('sos.endTitle'), t('sos.endMessage', { name: alert!.sender_name }), t('sos.endAction'), () =>
      end.mutate({ alertId: alert!.id, reason: 'ended_by_leader' }, { onError: (e) => setError(friendlyError(e)) }),
    );
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.banner}>
        <Avatar name={alert.sender_name} uri={publicUrl('avatars', alert.sender_avatar_path)} size={56} />
        <Text style={styles.bannerName}>{t('sos.needsHelp', { name: alert.sender_name })}</Text>
        <Text style={styles.bannerTime}>{t('sos.sentAt', { time: messageTime(new Date(alert.started_at)) })}</Text>
      </View>

      {alert.message ? (
        <Card>
          <Body>{alert.message}</Body>
        </Card>
      ) : null}

      <Card>
        <Heading>{t('sos.whereTheyAre')}</Heading>
        {alert.latitude !== null && alert.longitude !== null ? (
          <>
            <Body>
              {age !== null && age < 60 ? t('sos.secondsAgo', { count: age }) : t('sos.minutesAgo', { count: Math.round((age ?? 0) / 60) })}
              {alert.accuracy_m ? ` · ${t('sos.accuracy', { meters: Math.round(alert.accuracy_m) })}` : ''}
            </Body>
            <Button title={t('sos.openInMaps')} onPress={() => openInMaps(alert.latitude!, alert.longitude!, alert.sender_name)} />
            <Body muted>{t('sos.staleNote')}</Body>
          </>
        ) : (
          <Body muted>{t('sos.noLocationShared')}</Body>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>

      {!isMine ? <Button title={t('sos.messageThem', { name: alert.sender_name })} variant="secondary" onPress={messageSender} loading={opening} /> : null}
      <Button title={t('sos.callEmergency')} variant="danger" onPress={callEmergency} />
      <Body muted>{t('sos.emergencyNote')}</Body>
      {isLeader && !isMine ? <Button title={t('sos.endAction')} variant="secondary" onPress={endAlert} loading={end.isPending} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: SOS_RED, borderRadius: 20, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  bannerName: { color: '#FFFFFF', fontSize: 22, fontWeight: 700, textAlign: 'center' },
  bannerTime: { color: '#FFFFFF', fontSize: 15 },
});
