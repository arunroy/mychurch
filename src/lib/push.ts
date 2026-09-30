import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
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
