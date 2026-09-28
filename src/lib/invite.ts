import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';

const KEY = 'mychurch.pendingInviteCode';

/**
 * Someone who opens an invite link before signing in would lose the code on the
 * way through sign-in, so keep it until the join screen uses it.
 */
export function useRememberInviteLinks() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    if (!url) return;
    const { path, queryParams } = Linking.parse(url);
    const code = queryParams?.code;
    if (path?.replace(/^\/+/, '') === 'join' && typeof code === 'string' && code) {
      AsyncStorage.setItem(KEY, code.toUpperCase()).catch(() => {});
    }
  }, [url]);
}

export async function getPendingInviteCode() {
  return AsyncStorage.getItem(KEY).catch(() => null);
}

export async function clearPendingInviteCode() {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
