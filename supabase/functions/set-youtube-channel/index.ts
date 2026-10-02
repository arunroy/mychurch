// Sets, changes or removes the church's YouTube channel.
//
// The Pastor or a church admin sends the link they pasted. This function works out which channel it is,
// checks the channel really has a public video feed, and only then saves it. The channel columns are not
// writable from the app, so a church can only ever point at a real channel that was checked here.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { fetchChannelFeed, parseChannelLink, resolveChannelId } from '../_shared/youtube.ts';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return reply(401, { error: 'Sign in first.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return reply(401, { error: 'Sign in first.' });

  let input: { church_id?: unknown; url?: unknown };
  try {
    input = await request.json();
  } catch {
    return reply(400, { error: 'Send JSON.' });
  }
  const { church_id, url: link } = input;
  if (typeof church_id !== 'string') return reply(400, { error: 'Choose a church.' });
  if (typeof link !== 'string' || link.length > 300) return reply(400, { error: 'That link is too long.' });

  // The same people who can change the church's other settings.
  const { data: allowed, error: roleError } = await asCaller.rpc('has_church_role', {
    p_church: church_id,
    p_roles: ['pastor', 'admin'],
  });
  if (roleError) {
    console.error('set-youtube-channel role check failed', roleError);
    return reply(500, { error: `Could not check your role (${roleError.code ?? 'error'}).` });
  }
  if (!allowed) return reply(403, { error: 'Only the Pastor or a church admin can set the YouTube channel.' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // An empty link removes the channel.
  if (link.trim() === '') {
    const { error } = await admin.from('churches').update({ youtube_url: null, youtube_channel_id: null, youtube_last_video_id: null, youtube_last_published_at: null }).eq('id', church_id);
    if (error) {
      console.error('set-youtube-channel clear failed', error);
      return reply(500, { error: 'Could not remove the channel. Try again.' });
    }
    return reply(200, { removed: true });
  }

  const parsed = parseChannelLink(link);
  if (!parsed) {
    return reply(422, {
      error: 'That does not look like a YouTube channel link. Use the link to the channel itself, like youtube.com/@yourchurch.',
    });
  }

  let channelId: string | null;
  try {
    channelId = await resolveChannelId(parsed);
  } catch {
    return reply(502, { error: 'Could not reach YouTube right now. Try again in a moment.' });
  }
  if (!channelId) return reply(422, { error: 'We could not find a YouTube channel at that link. Check it and try again.' });

  let feed;
  try {
    feed = await fetchChannelFeed(channelId);
  } catch {
    return reply(502, { error: 'Could not reach YouTube right now. Try again in a moment.' });
  }
  if (!feed) return reply(422, { error: 'We found the channel, but could not read its videos. Check that the channel is public.' });

  const canonical = `https://www.youtube.com/channel/${channelId}`;
  const { error } = await admin
    .from('churches')
    // Remember the newest video now, so members are only told about uploads from here on.
    .update({
      youtube_url: link.trim(),
      youtube_channel_id: channelId,
      youtube_last_video_id: feed.videos[0]?.id ?? null,
      youtube_last_published_at: feed.videos[0]?.published_at ?? new Date().toISOString(),
    })
    .eq('id', church_id);
  if (error) {
    console.error('set-youtube-channel save failed', error);
    return reply(500, { error: 'Could not save the channel. Try again.' });
  }

  return reply(200, { channel_title: feed.channel_title, channel_url: canonical, video_count: feed.videos.length });
});
