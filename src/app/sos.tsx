import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch } from '@/lib/church';
import {
  askLocationPermission,
  callEmergency,
  getPosition,
  hasLocationPermission,
  updateSosLocation,
  useActiveSosAlerts,
  useEndSos,
  useSendSos,
  watchPosition,
  type Position,
} from '@/lib/sos';
import { useShakePreference } from '@/lib/shake';
import { friendlyError } from '@/lib/supabase';

const HOLD_MS = 3000;
const COUNTDOWN_SECONDS = 5;
const SOS_RED = '#D92D20';

type Phase = 'ready' | 'countdown' | 'sending';

/** Where a member in danger alerts the church. Hold, wait out a short countdown (which can be cancelled), and it goes. */
export default function SosScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { church } = useActiveChurch();
  const userId = useUserId();
  const alerts = useActiveSosAlerts(church.id);
  const send = useSendSos(church.id);
  const end = useEndSos(church.id);

  const mine = alerts.data?.find((a) => a.sender_id === userId) ?? null;
  // Opened by shaking the phone: the countdown starts at once, and Cancel stops it.
  const { start } = useLocalSearchParams<{ start?: string }>();
  const [shakeEnabled, setShakeEnabled] = useShakePreference();
  const [phase, setPhase] = useState<Phase>(start === '1' ? 'countdown' : 'ready');
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [locationOk, setLocationOk] = useState<boolean | null>(null);
  const [notified, setNotified] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [progress] = useState(() => new Animated.Value(0));
  // The position is looked up while the countdown runs, so the alert goes the moment it ends.
  const positionLookup = useRef<Promise<Position | null> | null>(null);

  useEffect(() => {
    hasLocationPermission().then(setLocationOk);
    // Opened by a shake: find the position while the countdown runs.
    if (start === '1') positionLookup.current = getPosition();
  }, [start]);

  // Keeps "last updated N seconds ago" honest.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  // While the alert is open and this screen is showing, keep the church's copy of the location current.
  const alertId = mine?.id;
  useEffect(() => {
    if (!alertId) return;
    let stop = () => {};
    let cancelled = false;
    watchPosition((position) => {
      updateSosLocation(alertId, position).catch(() => {});
    }).then((stopWatching) => {
      if (cancelled) stopWatching();
      else stop = stopWatching;
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [alertId]);

  const sendNow = useCallback(async () => {
    setPhase('sending');
    setError(null);
    try {
      const position = await (positionLookup.current ?? getPosition());
      const result = await send.mutateAsync({ position, message: '' });
      setNotified(result.notified);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      positionLookup.current = null;
      setPhase('ready');
    }
  }, [send]);

  // The countdown.
  useEffect(() => {
    if (phase !== 'countdown') return;
    const id = setTimeout(() => {
      if (seconds <= 1) sendNow();
      else setSeconds(seconds - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [phase, seconds, sendNow]);

  function startCountdown() {
    positionLookup.current = getPosition();
    setSeconds(COUNTDOWN_SECONDS);
    setPhase('countdown');
  }

  function cancelCountdown() {
    positionLookup.current = null;
    setPhase('ready');
  }

  function pressIn() {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => {
      if (finished) startCountdown();
    });
  }

  function pressOut() {
    progress.stopAnimation();
    progress.setValue(0);
  }

  async function allowLocation() {
    setLocationOk(await askLocationPermission());
  }

  function endAlert(reason: 'safe' | 'false_alarm') {
    setError(null);
    end.mutate({ alertId: mine!.id, reason }, { onError: (e) => setError(friendlyError(e)) });
  }

  async function updateNow() {
    if (!mine) return;
    setError(null);
    const position = await getPosition();
    if (!position) {
      setError(t('sos.noLocationNow'));
      return;
    }
    try {
      await updateSosLocation(mine.id, position);
      alerts.refetch();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  if (alerts.isPending) return <Loading />;

  if (mine) {
    const locationAge = mine.location_at ? Math.max(0, Math.round((now - new Date(mine.location_at).getTime()) / 1000)) : null;
    return (
      <Screen edges={['bottom']}>
        <View style={[styles.sentCard, { backgroundColor: SOS_RED }]}>
          <Ionicons name="alert-circle" size={44} color="#FFFFFF" />
          <Text style={styles.sentTitle}>{t('sos.sentTitle')}</Text>
          <Text style={styles.sentBody}>
            {notified !== null ? t('sos.sentNotified', { count: notified }) : t('sos.sentBody')}
          </Text>
        </View>

        <Card>
          <Heading>{t('sos.yourLocation')}</Heading>
          {mine.latitude !== null && locationAge !== null ? (
            <Body>{t('sos.locationUpdated', { age: ageText(locationAge, t) })}</Body>
          ) : (
            <Body muted>{t('sos.noLocationShared')}</Body>
          )}
          <Body muted>{t('sos.keepOpen')}</Body>
          <Button title={t('sos.updateLocation')} variant="secondary" onPress={updateNow} />
        </Card>

        <ErrorText>{error}</ErrorText>

        <Button title={t('sos.imSafe')} onPress={() => endAlert('safe')} loading={end.isPending} />
        <Button title={t('sos.falseAlarm')} variant="secondary" onPress={() => endAlert('false_alarm')} disabled={end.isPending} />
        <Button title={t('sos.callEmergency')} variant="danger" onPress={callEmergency} />
        <Body muted>{t('sos.emergencyNote')}</Body>
      </Screen>
    );
  }

  if (phase !== 'ready') {
    return (
      <Screen edges={['bottom']}>
        <View style={[styles.sentCard, { backgroundColor: SOS_RED }]}>
          <Text style={styles.countdown}>{phase === 'sending' ? '…' : seconds}</Text>
          <Text style={styles.sentTitle}>{phase === 'sending' ? t('sos.sending') : t('sos.sendingIn')}</Text>
        </View>
        {phase === 'countdown' ? <Button title={t('common.cancel')} onPress={cancelCountdown} /> : null}
        <Button title={t('sos.callEmergency')} variant="danger" onPress={callEmergency} />
      </Screen>
    );
  }

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Heading>{t('sos.title')}</Heading>
        <Body>{t('sos.explain', { church: church.name })}</Body>
        <Body muted>{t('sos.emergencyNote')}</Body>
        <Button title={t('sos.callEmergency')} variant="danger" onPress={callEmergency} />
      </Card>

      <Card>
        <Heading>{t('sos.locationHeading')}</Heading>
        <Body>{t('sos.locationDisclosure')}</Body>
        {locationOk === true ? (
          <Body muted>{t('sos.locationOn')}</Body>
        ) : (
          <>
            {locationOk === false ? <Body muted>{t('sos.locationOff')}</Body> : null}
            <Button title={t('sos.allowLocation')} variant="secondary" onPress={allowLocation} />
          </>
        )}
      </Card>

      <Card>
        <ToggleRow title={t('sos.shakeTitle')} subtitle={t('sos.shakeHint')} value={shakeEnabled} onValueChange={setShakeEnabled} />
      </Card>

      <ErrorText>{error}</ErrorText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('sos.holdLabel')}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.holdButton, { borderColor: SOS_RED, backgroundColor: theme.backgroundElement }]}>
        <Animated.View style={[styles.holdFill, { width }]} />
        <View style={styles.holdContent}>
          <Ionicons name="alert-circle" size={36} color={SOS_RED} />
          <Text style={[styles.holdText, { color: theme.text }]}>{t('sos.holdToSend')}</Text>
        </View>
      </Pressable>
      <Body muted>{t('sos.holdHint')}</Body>
      <Gap size={Spacing.two} />
      <Button
        title={t('sos.cancelScreen')}
        variant="secondary"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/')
        }
      />
    </Screen>
  );
}

/** "12 seconds ago", "3 minutes ago". */
function ageText(seconds: number, t: (key: string, options?: Record<string, unknown>) => string) {
  if (seconds < 60) return t('sos.secondsAgo', { count: seconds });
  return t('sos.minutesAgo', { count: Math.round(seconds / 60) });
}

const styles = StyleSheet.create({
  sentCard: { borderRadius: 20, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  sentTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 700, textAlign: 'center' },
  sentBody: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
  countdown: { color: '#FFFFFF', fontSize: 72, fontWeight: 800 },
  holdButton: { height: 120, borderRadius: 24, borderWidth: 3, overflow: 'hidden', justifyContent: 'center' },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#D92D2033' },
  holdContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  holdText: { fontSize: 22, fontWeight: 700 },
});
