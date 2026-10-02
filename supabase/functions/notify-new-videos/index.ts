// Tells members when their church's YouTube channel has a new video.
//
// Run on a schedule (see supabase/scheduled/notify-new-videos.sql), not by the app: it only answers the
// service role. For each church with a channel it reads the public feed and compares it with the newest
// video already announced. YouTube does not push uploads to us, so this checks every few minutes.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { sendPush, type PushMessage } from '../_shared/expo-push.ts';
import { fetchChannelFeed } from '../_shared/youtube.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** How many churches are read at once, so one slow channel does not hold up the rest. */
const PARALLEL = 5;

type ChurchRow = {
  id: string;
  name: string;
  youtube_channel_id: string;
  youtube_last_published_at: string | null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });

  // Only the scheduler, which calls with the service role key.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (request.headers.get('Authorization') !== `Bearer ${serviceKey}`) return reply(401, { error: 'Not allowed.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const { data: churches, error } = await admin
    .from('churches')
    .select('id, name, youtube_channel_id, youtube_last_published_at')
    .eq('status', 'active')
    .not('youtube_channel_id', 'is', null);
  if (error) {
    console.error('notify-new-videos could not list churches', error);
    return reply(500, { error: 'Could not list churches.' });
  }

  let announced = 0;
  let notified = 0;

  async function check(church: ChurchRow) {
    let feed;
    try {
      feed = await fetchChannelFeed(church.youtube_channel_id);
    } catch {
      return;
    }
    const newest = feed?.videos[0];
    if (!feed || !newest) return;

    // First look at this channel (saved before notifications existed): remember where it is, tell no one.
    if (!church.youtube_last_published_at) {
      await admin
        .from('churches')
        .update({ youtube_last_video_id: newest.id, youtube_last_published_at: newest.published_at })
        .eq('id', church.id)
        .is('youtube_last_published_at', null);
      return;
    }

    const since = Date.parse(church.youtube_last_published_at);
    if (!(Date.parse(newest.published_at) > since)) return;

    // Claim the new video before sending, so two overlapping runs cannot both announce it.
    const { data: claimed } = await admin
      .from('churches')
      .update({ youtube_last_video_id: newest.id, youtube_last_published_at: newest.published_at })
      .eq('id', church.id)
      .eq('youtube_last_published_at', church.youtube_last_published_at)
      .select('id');
    if (!claimed?.length) return;
    announced += 1;

    try {
      const { data: members } = await admin
        .from('memberships')
        .select('user_id')
        .eq('church_id', church.id)
        .eq('status', 'approved');
      const userIds = (members ?? []).map((m) => m.user_id as string);
      if (userIds.length === 0) return;

      const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', userIds);
      // The title is the church and the body is the video's own title, so no wording needs translating.
      const messages: PushMessage[] = (tokens ?? []).map((t) => ({
        to: t.token as string,
        title: church.name,
        body: `▶ ${newest.title}`.slice(0, 140),
        sound: 'default',
        channelId: 'default',
        data: { type: 'video', church_id: church.id, video_id: newest.id },
      }));
      const { accepted, dead } = await sendPush(messages);
      notified += accepted;
      if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);
    } catch (e) {
      console.error('notify-new-videos push failed', church.id, e);
    }
  }

  const list = (churches ?? []) as ChurchRow[];
  for (let i = 0; i < list.length; i += PARALLEL) {
    await Promise.all(list.slice(i, i + PARALLEL).map(check));
  }

  return reply(200, { churches: list.length, announced, notified });
});
