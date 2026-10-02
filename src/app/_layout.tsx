import { Ionicons } from '@expo/vector-icons';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LanguageProvider } from '@/i18n/language-preference';
import { useTheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth, useProfile } from '@/lib/auth';
import { ChurchProvider, useChurch } from '@/lib/church';
import { ShakeToSos } from '@/components/shake-to-sos';
import { useRememberInviteLinks } from '@/lib/invite';
import { registerForPushNotifications, useOpenNotificationTarget } from '@/lib/push';
import { isConfigured } from '@/lib/supabase';
import { ThemePreferenceProvider } from '@/lib/theme-preference';

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
    <LanguageProvider>
      <ThemePreferenceProvider>
        <ThemedApp />
      </ThemePreferenceProvider>
    </LanguageProvider>
  );
}

function ThemedApp() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];

  // The navigator draws screen and header backgrounds in the page colour, so every screen sits on the same calm ground.
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, background: palette.page, card: palette.page, text: palette.text, border: palette.hairline },
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.page }]}>
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
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.close')}
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(home))}
      style={styles.closeButton}>
      <Ionicons name="close" size={24} color={theme.text} />
    </Pressable>
  );
}

function RootNavigator() {
  const { t } = useTranslation();
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
    <>
      {onboarded && state === 'ready' ? <ShakeToSos /> : null}
      <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerTitleStyle: { fontSize: 17, fontWeight: '700' },
      }}>
        <Stack.Screen name="privacy" options={{ title: t('titles.privacy'), headerLeft: closeLegal }} />
        <Stack.Screen name="terms" options={{ title: t('titles.terms'), headerLeft: closeLegal }} />

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
          <Stack.Screen name="church-settings" options={{ title: t('shortcuts.churchSettings') }} />
          <Stack.Screen name="bible" options={{ title: t('titles.bible') }} />
          <Stack.Screen name="chat-groups" options={{ title: t('chatGroups.title') }} />
          <Stack.Screen name="chat-group-edit" options={{ title: t('chatGroups.groupTitle') }} />
          <Stack.Screen name="funds" options={{ title: t('shortcuts.funds') }} />
          <Stack.Screen name="videos" options={{ title: t('shortcuts.videos') }} />
          <Stack.Screen name="bible-notes" options={{ title: t('titles.myNotes') }} />
          <Stack.Screen name="bible-study" options={{ title: t('titles.bibleStudy') }} />
          <Stack.Screen name="bible-study/christ" options={{ title: t('titles.christ') }} />
          <Stack.Screen name="bible-study/doctrines" options={{ title: t('titles.doctrines') }} />
          <Stack.Screen name="bible-study/paul" options={{ title: t('titles.paul') }} />
          <Stack.Screen name="bible-study/books" options={{ title: t('titles.books') }} />
          <Stack.Screen name="bible-study/promises" options={{ title: t('titles.promises') }} />
          <Stack.Screen name="bible-study/quiz" options={{ title: t('titles.quiz') }} />
          <Stack.Screen name="bible-study/quiz-questions" options={{ title: t('titles.quizQuestions') }} />
          <Stack.Screen name="special-days" options={{ title: t('shortcuts.specialDays') }} />
          <Stack.Screen name="members" options={{ title: t('shortcuts.members') }} />
          <Stack.Screen name="member/[id]" options={{ title: t('sermons.tagMember') }} />
          <Stack.Screen name="polls" options={{ title: t('shortcuts.polls') }} />
          <Stack.Screen name="poll-new" options={{ title: t('titles.newPoll') }} />
          <Stack.Screen name="elders/index" options={{ title: t('elders.theElders') }} />
          <Stack.Screen name="elders/[id]" options={{ title: t('elders.theElders') }} />
          <Stack.Screen name="anonymous" options={{ title: t('titles.writeAnon') }} />
          <Stack.Screen name="anonymous-inbox" options={{ title: t('messagesTab.anonInbox') }} />
          <Stack.Screen name="qa" options={{ title: t('shortcuts.qa') }} />
          <Stack.Screen name="reports" options={{ title: t('shortcuts.reports') }} />
          <Stack.Screen name="sermons" options={{ title: t('shortcuts.sermons') }} />
          <Stack.Screen name="sermon/[id]" options={{ title: t('sermonEdit.sermon') }} />
          <Stack.Screen name="sermon-write" options={{ title: t('sermons.writeArticle') }} />
          <Stack.Screen name="sermon-suggest" options={{ title: t('titles.shareSermon') }} />
          <Stack.Screen name="sermon-edit" options={{ title: t('sermonEdit.sermon') }} />
          <Stack.Screen name="prayer" options={{ title: t('shortcuts.prayer') }} />
          <Stack.Screen name="prayer-new" options={{ title: t('titles.shareRequest') }} />
          <Stack.Screen name="announcements" options={{ title: t('shortcuts.announcements') }} />
          <Stack.Screen name="daily-verse" options={{ title: t('shortcuts.dailyVerse') }} />
          <Stack.Screen name="verse-edit" options={{ title: t('dailyVerse.verseHeading') }} />
          <Stack.Screen name="event/[id]" options={{ title: t('titles.event') }} />
          <Stack.Screen name="event-edit" options={{ title: t('titles.event') }} />
          <Stack.Screen name="new-message" options={{ title: t('messagesTab.newMessage') }} />
          <Stack.Screen name="chat/[id]" options={{ title: t('chatTab.title') }} />
          <Stack.Screen name="worship" options={{ title: t('shortcuts.worship') }} />
          <Stack.Screen name="worship-planner" options={{ title: t('shortcuts.worshipPlanner') }} />
          <Stack.Screen name="songs" options={{ title: t('songs.title') }} />
          <Stack.Screen name="fundraisers" options={{ title: t('shortcuts.fundraisers') }} />
          <Stack.Screen name="fundraiser" options={{ title: t('shortcuts.fundraisers') }} />
          <Stack.Screen name="profile" options={{ title: t('titles.profile') }} />
          <Stack.Screen name="sos" options={{ title: t('shortcuts.sos') }} />
          <Stack.Screen name="sos-alert" options={{ title: t('shortcuts.sos') }} />
          <Stack.Screen name="sos-history" options={{ title: t('shortcuts.sosHistory') }} />
        </Stack.Protected>

        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="delete-account" options={{ title: t('titles.deleteAccount') }} />
          <Stack.Screen name="join" options={{ title: t('start.joinButton') }} />
          <Stack.Screen name="register" options={{ title: t('start.registerButton') }} />
          <Stack.Screen name="switch-church" options={{ title: t('titles.yourChurches'), presentation: 'modal' }} />
          <Stack.Screen name="review-churches" options={{ title: t('more.verifyChurches') }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
