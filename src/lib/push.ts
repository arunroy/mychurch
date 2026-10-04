import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Show notifications that arrive while the app is open, instead of swallowing them.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Opens the right screen when someone taps a notification: a private message, or an event reminder.
 * Pass `enabled` once the person is signed in and inside a church, so the screen can open.
 */
export function useOpenNotificationTarget(enabled: boolean) {
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !enabled || !last) return;
    if (last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const data = last.notification.request.content.data as Record<string, unknown>;
    if (data.type === 'message' && typeof data.conversation_id === 'string') {
      router.push({ pathname: '/chat/[id]', params: { id: data.conversation_id } });
    } else if (data.type === 'elders' && typeof data.thread_id === 'string') {
      router.push({ pathname: '/elders/[id]', params: { id: data.thread_id } });
    } else if (data.type === 'event' && typeof data.event_id === 'string') {
      router.push({ pathname: '/event/[id]', params: { id: data.event_id } });
    } else if (data.type === 'video') {
      router.push('/videos');
    } else if (data.type === 'fasting') {
      router.push('/fasting');
    } else if (data.type === 'sos' && typeof data.alert_id === 'string') {
      router.push({ pathname: '/sos-alert', params: { id: data.alert_id } });
    }
  }, [last, enabled]);
}

/**
 * Asks for notification permission and saves this device's push token so the
 * server can reach it. Quietly does nothing where push can't work: simulators,
 * the web, Expo Go on Android, or before the app has an EAS project id.
 */
export async function registerForPushNotifications(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Church updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    // SOS alerts: the loudest kind, so they are seen and heard straight away.
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'SOS alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      sound: 'default',
      bypassDnd: true,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase.from('push_tokens').upsert({
    token,
    user_id: userId,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    updated_at: new Date().toISOString(),
  });
}
