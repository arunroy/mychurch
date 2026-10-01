import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { callFunction } from './functions';
import { supabase } from './supabase';

/** Things kept only on this phone for the person, cleared when they delete their account. */
const LOCAL_KEYS = ['anonymous-reply-codes', 'event-reminders'];

/**
 * Deletes the signed-in person's account on the server, then clears what the app kept on this phone and
 * signs out. The server refuses (with a message that is shown to the person) if they are the only Pastor
 * of a church that still has other members.
 */
export async function deleteMyAccount() {
  await callFunction('delete-account', { confirm: 'DELETE' });

  await AsyncStorage.multiRemove(LOCAL_KEYS).catch(() => {});
  if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  // The account is gone, so only end the session on this phone; there is nothing left to tell the server.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
