// The church's latest YouTube videos, newest first, for the Videos screen.
//
// Any approved member of the church may ask. The channel was checked when the Pastor saved it; here we
// only read its public feed. Feeds are kept for a few minutes so many members opening Videos at once
// make one request to YouTube between them.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { fetchChannelFeed, type ChannelFeed } from '../_shared/youtube.ts';

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

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; feed: ChannelFeed }>();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return reply(401, { error: 'Sign in first.' });

  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return reply(401, { error: 'Sign in first.' });

  let input: { church_id?: unknown };
  try {
    input = await request.json();
  } catch {
    return reply(400, { error: 'Send JSON.' });
  }
  if (typeof input.church_id !== 'string') return reply(400, { error: 'Choose a church.' });

  const { data: member, error: memberError } = await asCaller.rpc('is_church_member', { p_church: input.church_id });
  if (memberError) {
    console.error('church-videos member check failed', memberError);
    return reply(500, { error: `Could not check your membership (${memberError.code ?? 'error'}).` });
  }
  if (!member) return reply(403, { error: 'Only members of this church can see its videos.' });

  const { data: church, error: churchError } = await asCaller
    .from('churches')
    .select('youtube_channel_id')
    .eq('id', input.church_id)
    .maybeSingle();
  if (churchError) {
    console.error('church-videos church lookup failed', churchError);
    return reply(500, { error: 'Could not load the church.' });
  }

  const channelId = church?.youtube_channel_id;
  if (!channelId) return reply(200, { configured: false, videos: [] });

  const cached = cache.get(channelId);
  let feed = cached && Date.now() - cached.at < CACHE_MS ? cached.feed : null;
  if (!feed) {
    try {
      feed = await fetchChannelFeed(channelId);
    } catch {
      feed = null;
    }
    if (feed) cache.set(channelId, { at: Date.now(), feed });
    // If YouTube is slow or down, an older copy is better than an empty screen.
    else if (cached) feed = cached.feed;
  }
  if (!feed) return reply(502, { error: 'Could not load the videos from YouTube right now. Try again in a moment.' });

  return reply(200, {
    configured: true,
    channel_title: feed.channel_title,
    channel_url: `https://www.youtube.com/channel/${channelId}`,
    videos: feed.videos,
  });
});
