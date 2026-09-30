import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { Colors, findGradient } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth, useProfile } from '@/lib/auth';
import { ChurchProvider, useChurch } from '@/lib/church';
import { useRememberInviteLinks } from '@/lib/invite';
import { registerForPushNotifications } from '@/lib/push';
import { isConfigured } from '@/lib/supabase';
import { ThemePreferenceProvider, useThemePreference } from '@/lib/theme-preference';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// Refetch when the app comes back to the foreground, so approvals show up without a manual refresh.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <ThemedApp />
    </ThemePreferenceProvider>
  );
}

function ThemedApp() {
  const colorScheme = useColorScheme();
  const { gradient } = useThemePreference();
  const colors = findGradient(gradient)?.[colorScheme];

  // With a gradient chosen, the navigator's own backgrounds go clear so the gradient shows through every screen.
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = colors ? { ...base, colors: { ...base.colors, background: 'transparent', card: 'transparent' } } : base;

  return (
    <View style={[styles.root, { backgroundColor: Colors[colorScheme].background }]}>
      {colors ? (
        <LinearGradient
          colors={[...colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <ThemeProvider value={navigationTheme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ChurchProvider>
              <RootNavigator />
            </ChurchProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

function RootNavigator() {
  const { session, loading: authLoading } = useAuth();
  const profile = useProfile();
  const { state } = useChurch();
  useRememberInviteLinks();

  const signedIn = isConfigured && !!session;
  const loading = authLoading || (signedIn && (profile.isPending || state === 'loading'));
  const needsName = signedIn && !profile.isPending && !profile.data?.full_name;
  const onboarded = signedIn && !loading && !needsName;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (session?.user.id) registerForPushNotifications(session.user.id).catch(() => {});
  }, [session?.user.id]);

  // Keep the splash screen up until we know where the person belongs. Rendering the
  // navigator earlier would send an opened link (like an invite) to the wrong screen.
  if (loading) return null;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!isConfigured}>
        <Stack.Screen name="setup-needed" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={isConfigured && !signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={needsName}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={onboarded && state === 'none'}>
        <Stack.Screen name="start" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={onboarded && state === 'waiting'}>
        <Stack.Screen name="waiting" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={onboarded && state === 'ready'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="church-settings" options={{ title: 'Church settings' }} />
        <Stack.Screen name="members" options={{ title: 'Members' }} />
        <Stack.Screen name="member/[id]" options={{ title: 'Member' }} />
        <Stack.Screen name="polls" options={{ title: 'Polls' }} />
        <Stack.Screen name="poll-new" options={{ title: 'New poll' }} />
        <Stack.Screen name="prayer" options={{ title: 'Prayer requests' }} />
        <Stack.Screen name="prayer-new" options={{ title: 'Share a request' }} />
        <Stack.Screen name="announcements" options={{ title: 'Announcements' }} />
        <Stack.Screen name="daily-verse" options={{ title: 'Daily verse' }} />
        <Stack.Screen name="verse-edit" options={{ title: 'Verse' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="event-edit" options={{ title: 'Event' }} />
        <Stack.Screen name="new-message" options={{ title: 'New message' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
      </Stack.Protected>

      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="join" options={{ title: 'Join a church' }} />
        <Stack.Screen name="register" options={{ title: 'Register a church' }} />
        <Stack.Screen name="switch-church" options={{ title: 'Your churches', presentation: 'modal' }} />
        <Stack.Screen name="review-churches" options={{ title: 'Verify churches' }} />
      </Stack.Protected>
    </Stack>
  );
}
