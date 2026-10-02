import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { useChurchVideos, type ChurchVideo } from './videos';

// Which videos a person has already looked at, kept on this phone: the publish time of the newest one
// they have seen. Anything newer counts as new. Nothing is stored on the server.

const key = (churchId: string) => `videos-seen:${churchId}`;

/** The newest video time this phone has seen for the church. Null until Videos has been looked at once. */
export function useSeenVideos(churchId: string) {
  return useQuery({
    queryKey: ['videos-seen', churchId],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => (await AsyncStorage.getItem(key(churchId))) ?? null,
  });
}

/** Remembers that everything up to this publish time has been seen. */
export function useMarkVideosSeen(churchId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (publishedAt: string) => {
      queryClient.setQueryData(['videos-seen', churchId], publishedAt);
      AsyncStorage.setItem(key(churchId), publishedAt).catch(() => {});
    },
    [churchId, queryClient],
  );
}

export function isNewVideo(video: ChurchVideo, seen: string | null | undefined) {
  return !!seen && video.published_at > seen;
}

/**
 * How many videos are new to this person, for the badge on Home. The first time a church's videos are
 * loaded on a phone nothing counts as new: the newest is taken as the starting point.
 */
export function useUnseenVideoCount(churchId: string, channelId: string | null) {
  const videos = useChurchVideos(churchId, channelId);
  const seen = useSeenVideos(churchId);
  const markSeen = useMarkVideosSeen(churchId);

  const list = videos.data?.videos ?? [];
  const newest = list[0]?.published_at;

  useEffect(() => {
    if (seen.isSuccess && seen.data === null && newest) markSeen(newest);
  }, [seen.isSuccess, seen.data, newest, markSeen]);

  if (!channelId || !seen.data) return 0;
  return list.filter((video) => isNewVideo(video, seen.data)).length;
}
