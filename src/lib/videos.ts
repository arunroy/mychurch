import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { callFunction } from './functions';

export type ChurchVideo = {
  id: string;
  title: string;
  /** ISO time the video was published. */
  published_at: string;
  thumbnail: string;
  description: string;
};

export type ChurchVideos = {
  /** False when the church has not added a channel yet. */
  configured: boolean;
  channel_title?: string;
  channel_url?: string;
  /** Newest first. */
  videos: ChurchVideo[];
};

export function videoUrl(id: string) {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** The church's latest YouTube videos. The channel id is part of the key so a new channel loads at once. */
export function useChurchVideos(churchId: string, channelId: string | null) {
  return useQuery({
    queryKey: ['church-videos', churchId, channelId],
    enabled: !!channelId,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: () => callFunction<ChurchVideos>('church-videos', { church_id: churchId }),
  });
}

export type ChannelSaved = { removed?: boolean; channel_title?: string; channel_url?: string; video_count?: number };

/** Saves the channel link (or removes the channel with an empty link). The server checks the channel is real first. */
export function useSetYoutubeChannel(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => callFunction<ChannelSaved>('set-youtube-channel', { church_id: churchId, url }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['church-videos', churchId] }),
  });
}
