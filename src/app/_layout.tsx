import { Ionicons } from '@expo/vector-icons';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Colors, findTheme, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth, useProfile } from '@/lib/auth';
import { ChurchProvider, useChurch } from '@/lib/church';
import { useRememberInviteLinks } from '@/lib/invite';
import { registerForPushNotifications, useOpenNotificationTarget } from '@/lib/push';
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
  const { themeId } = useThemePreference();
  const colors = findTheme(themeId)?.[colorScheme].gradient;

  // With a theme chosen, the navigator's own backgrounds go clear so the gradient shows through every screen.
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
  closeButton: { padding: Spacing.one },
});

// Privacy/terms can be the only screen in the stack (opened before sign-in, or restored
// directly to one of these routes), so the default back arrow may not appear. This always
// has somewhere to go: back if there's history, otherwise to wherever the person belongs.
// "/" only exists for church members (it's the tabs screen, behind a guard), so everyone
// else is sent to the screen their sign-in state allows.
function CloseLegalScreen({ home }: { home: Href }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(home))}
      style={styles.closeButton}>
      <Ionicons name="close" size={24} color={theme.text} />
    </Pressable>
  );
}

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

  useOpenNotificationTarget(onboarded && state === 'ready');

  // Keep the splash screen up until we know where the person belongs. Rendering the
  // navigator earlier would send an opened link (like an invite) to the wrong screen.
  if (loading) return null;

  const home: Href = !isConfigured
    ? '/setup-needed'
    : !signedIn
      ? '/sign-in'
      : needsName
        ? '/welcome'
        : state === 'none'
          ? '/start'
          : state === 'waiting'
            ? '/waiting'
            : '/';
  const closeLegal = () => <CloseLegalScreen home={home} />;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="privacy" options={{ title: 'Privacy policy', headerLeft: closeLegal }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of use', headerLeft: closeLegal }} />

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
        <Stack.Screen name="bible" options={{ title: 'Bible' }} />
        <Stack.Screen name="bible-notes" options={{ title: 'My notes' }} />
        <Stack.Screen name="bible-study" options={{ title: 'Bible study' }} />
        <Stack.Screen name="bible-study/christ" options={{ title: 'Jesus quick reference' }} />
        <Stack.Screen name="bible-study/doctrines" options={{ title: 'New Testament doctrines' }} />
        <Stack.Screen name="bible-study/paul" options={{ title: "Paul's letters" }} />
        <Stack.Screen name="bible-study/books" options={{ title: 'Books of the Bible' }} />
        <Stack.Screen name="bible-study/promises" options={{ title: 'Promises and help' }} />
        <Stack.Screen name="bible-study/quiz" options={{ title: 'Bible quiz' }} />
        <Stack.Screen name="bible-study/quiz-questions" options={{ title: 'Quiz questions' }} />
        <Stack.Screen name="special-days" options={{ title: 'Birthdays and anniversaries' }} />
        <Stack.Screen name="members" options={{ title: 'Members' }} />
        <Stack.Screen name="member/[id]" options={{ title: 'Member' }} />
        <Stack.Screen name="polls" options={{ title: 'Polls' }} />
        <Stack.Screen name="poll-new" options={{ title: 'New poll' }} />
        <Stack.Screen name="elders/index" options={{ title: 'The elders' }} />
        <Stack.Screen name="elders/[id]" options={{ title: 'Elders' }} />
        <Stack.Screen name="anonymous" options={{ title: 'Write anonymously' }} />
        <Stack.Screen name="anonymous-inbox" options={{ title: 'Anonymous inbox' }} />
        <Stack.Screen name="qa" options={{ title: 'Questions & answers' }} />
        <Stack.Screen name="reports" options={{ title: 'Reports' }} />
        <Stack.Screen name="sermons" options={{ title: 'Sermons' }} />
        <Stack.Screen name="sermon/[id]" options={{ title: 'Sermon' }} />
        <Stack.Screen name="sermon-write" options={{ title: 'Write an article' }} />
        <Stack.Screen name="sermon-suggest" options={{ title: 'Share a sermon' }} />
        <Stack.Screen name="sermon-edit" options={{ title: 'Sermon' }} />
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
        <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
        <Stack.Screen name="join" options={{ title: 'Join a church' }} />
        <Stack.Screen name="register" options={{ title: 'Register a church' }} />
        <Stack.Screen name="switch-church" options={{ title: 'Your churches', presentation: 'modal' }} />
        <Stack.Screen name="review-churches" options={{ title: 'Verify churches' }} />
      </Stack.Protected>
    </Stack>
  );
}
