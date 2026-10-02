-- Remembering which video was last announced, so members are told about a new upload once.
--
-- The notify-new-videos function runs every few minutes. For each church with a YouTube channel it looks
-- at the channel's feed and notifies members of anything published after youtube_last_published_at. When
-- a channel is first saved, set-youtube-channel records the current newest video here, so nobody is
-- told about old uploads. Like the channel columns, these are not in the update grant on churches:
-- only the functions (the service role) write them.

alter table public.churches
  add column youtube_last_video_id text check (youtube_last_video_id is null or char_length(youtube_last_video_id) <= 20),
  add column youtube_last_published_at timestamptz;
