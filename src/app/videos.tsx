import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, useAccent } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { getDateLocale } from '@/lib/dates';
import { friendlyError } from '@/lib/supabase';
import { isNewVideo, useMarkVideosSeen, useSeenVideos } from '@/lib/video-seen';
import { useChurchVideos, videoUrl, type ChurchVideo } from '@/lib/videos';

// The church's latest YouTube videos, newest first. Tapping one opens it in YouTube.
export default function VideosScreen() {
  const { t } = useTranslation();
  const { church } = useActiveChurch();
  const { canEditChurch } = usePermissions();
  const videos = useChurchVideos(church.id, church.youtube_channel_id);
  const seen = useSeenVideos(church.id);
  const markSeen = useMarkVideosSeen(church.id);

  // Videos shown as new stay tagged while this screen is open. Leaving it marks them all as seen.
  const newest = videos.data?.videos[0]?.published_at;
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (newest) markSeen(newest);
      };
    }, [newest, markSeen]),
  );

  if (!church.youtube_channel_id) {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <Heading>{t('videos.notSet')}</Heading>
          {canEditChurch ? (
            <>
              <Body muted>{t('videos.notSetPastor')}</Body>
              <Button title={t('videos.openSettings')} onPress={() => router.push('/church-settings')} />
            </>
          ) : (
            <Body muted>{t('videos.notSetMember')}</Body>
          )}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      {videos.isPending ? <Loading /> : null}
      <ErrorText>{videos.error ? friendlyError(videos.error) : null}</ErrorText>

      {videos.data ? (
        <>
          <Body muted>{videos.data.channel_title ? t('videos.from', { channel: videos.data.channel_title }) : t('videos.latest')}</Body>
          {videos.data.videos.length === 0 ? <Body muted>{t('videos.empty')}</Body> : null}
          {videos.data.videos.map((video) => (
            <VideoCard key={video.id} video={video} isNew={isNewVideo(video, seen.data)} />
          ))}
          {videos.data.channel_url ? (
            <Button title={t('videos.openChannel')} variant="secondary" onPress={() => Linking.openURL(videos.data!.channel_url!).catch(() => {})} />
          ) : null}
        </>
      ) : null}
      <Gap />
    </Screen>
  );
}

function VideoCard({ video, isNew }: { video: ChurchVideo; isNew: boolean }) {
  const accent = useAccent();
  const { t } = useTranslation();
  const theme = useTheme();
  const date = new Date(video.published_at).toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('videos.play', { title: video.title })}
      onPress={() => Linking.openURL(videoUrl(video.id)).catch(() => {})}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 }]}>
      <Image source={{ uri: video.thumbnail }} style={[styles.thumbnail, { backgroundColor: theme.backgroundSelected }]} contentFit="cover" />
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
          {video.title}
        </Text>
        <View style={styles.meta}>
          {isNew ? <Text style={[styles.newTag, { backgroundColor: accent }]}>{t('videos.new')}</Text> : null}
          <Text style={[styles.date, { color: theme.textSecondary }]}>{date}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden' },
  thumbnail: { width: '100%', aspectRatio: 16 / 9 },
  text: { padding: Spacing.three, gap: Spacing.one },
  title: { fontSize: 17, fontWeight: 600, lineHeight: 24 },
  date: { fontSize: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  newTag: { color: '#FFFFFF', fontSize: 12, fontWeight: 700, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
