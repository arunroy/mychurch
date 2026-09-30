// Posts an announcement and, if asked, sends a push notification to the church.
//
// Only the church's leaders (Pastor, elders, admins) may call this. The notice is saved first;
// the push is best effort, so a failed push never loses the announcement.

import { createClient } from 'npm:@supabase/supabase-js@2';

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

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo accepts up to 100 messages per request.

type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: 'default';
  data: Record<string, unknown>;
};

/** Sends the messages and returns how many were accepted, plus tokens Expo says no longer exist. */
async function sendPush(messages: PushMessage[]) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let accepted = 0;
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const response = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(batch) });
      if (!response.ok) {
        console.error('expo push failed', response.status, await response.text());
        continue;
      }
      const { data } = (await response.json()) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      data?.forEach((ticket, index) => {
        if (ticket.status === 'ok') accepted += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[index].to);
      });
    } catch (e) {
      console.error('expo push error', e);
    }
  }
  return { accepted, dead };
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
  const userId = userData.user.id;

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return reply(400, { error: 'Send JSON.' });
  }

  const { church_id, title, body, expires_at, notify } = input;
  if (typeof church_id !== 'string') return reply(400, { error: 'Choose a church.' });
  if (typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 100) {
    return reply(400, { error: 'Give the announcement a title of up to 100 characters.' });
  }
  const details = body === undefined ? '' : body;
  if (typeof details !== 'string' || details.length > 2000) {
    return reply(400, { error: 'The details are too long.' });
  }
  let expiresAt: string | null = null;
  if (expires_at !== undefined && expires_at !== null) {
    if (typeof expires_at !== 'string' || Number.isNaN(Date.parse(expires_at))) {
      return reply(400, { error: 'That end time is not valid.' });
    }
    expiresAt = new Date(expires_at).toISOString();
  }

  // Only leaders of this church may post.
  const { data: isLeader, error: roleError } = await asCaller.rpc('is_church_leader', { p_church: church_id });
  if (roleError) {
    console.error('post-announcement role check failed', roleError);
    return reply(500, { error: `Could not check your role (${roleError.code ?? 'error'}).` });
  }
  if (!isLeader) return reply(403, { error: 'Only the Pastor, elders and admins can post announcements.' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: announcement, error: insertError } = await admin
    .from('announcements')
    .insert({ church_id, author_id: userId, title: title.trim(), body: details.trim(), expires_at: expiresAt })
    .select()
    .single();
  if (insertError) {
    console.error('post-announcement insert failed', insertError);
    return reply(500, { error: `Could not post the announcement (${insertError.code ?? 'database error'}).` });
  }

  if (notify !== true) return reply(200, { announcement, notified: 0 });

  // Everyone approved in the church except the person posting, on each device they've registered.
  let notified = 0;
  try {
    const [{ data: church }, { data: members }] = await Promise.all([
      admin.from('churches').select('name').eq('id', church_id).single(),
      admin.from('memberships').select('user_id').eq('church_id', church_id).eq('status', 'approved').neq('user_id', userId),
    ]);
    const userIds = (members ?? []).map((m) => m.user_id as string);
    if (userIds.length > 0) {
      const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', userIds);
      const text = announcement.body ? announcement.body.slice(0, 140) : (church?.name ?? 'Your church');
      const messages: PushMessage[] = (tokens ?? []).map((t) => ({
        to: t.token as string,
        title: announcement.title,
        body: text,
        sound: 'default',
        channelId: 'default',
        data: { type: 'announcement', church_id, announcement_id: announcement.id },
      }));
      const { accepted, dead } = await sendPush(messages);
      notified = accepted;
      // Tokens for uninstalled apps: forget them so they aren't tried again.
      if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);
    }
  } catch (e) {
    console.error('post-announcement push failed', e);
  }

  return reply(200, { announcement, notified });
});
