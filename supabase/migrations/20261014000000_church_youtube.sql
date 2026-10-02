-- The church's YouTube channel.
--
-- The Pastor (or a church admin) pastes the channel's link in the church settings. The set-youtube-channel
-- function works out the channel id, checks the channel has a public video feed, and saves both. These
-- columns are deliberately NOT in the update grant on churches: nobody can write them straight from the
-- app, so a church can only point at a channel that function checked. Members read them with the rest of
-- the church row, and the church-videos function turns the channel id into the list of videos.

alter table public.churches
  add column youtube_url text check (youtube_url is null or char_length(youtube_url) between 1 and 300),
  add column youtube_channel_id text check (youtube_channel_id is null or youtube_channel_id ~ '^UC[0-9A-Za-z_-]{22}$');
