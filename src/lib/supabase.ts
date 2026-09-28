import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const isConfigured = Boolean(url && key);

export const supabase = createClient<Database>(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh the session while the app is in the foreground, as Supabase recommends for React Native.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export function publicUrl(bucket: 'church-logos' | 'avatars', path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Postgres errors raised by our functions carry a message written for people; everything else gets a generic one.
export function friendlyError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const code = 'code' in error ? String(error.code) : '';
    if (['P0001', 'P0002', '42501', '23514', '28000'].includes(code)) return error.message;
    if (error.message.toLowerCase().includes('network')) return 'Check your internet connection and try again.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
