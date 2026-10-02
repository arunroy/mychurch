// Starts an SOS alert for the caller and sends a loud push notification to everyone else in the church.
//
// The alert is created by the database function start_sos_alert, called as the caller, so the database decides
// whether they may (approved member, at most 3 a day). The push is best effort: the alert exists either way, and
// members also see it in the app. A repeat call while an alert is already open returns it without notifying again.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { sendPush, type PushMessage } from '../_shared/expo-push.ts';

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

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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

  const { church_id, latitude, longitude, accuracy, message } = input;
  if (typeof church_id !== 'string') return reply(400, { error: 'Choose a church.' });
  const text = message === undefined || message === null ? '' : message;
  if (typeof text !== 'string' || text.length > 200) return reply(400, { error: 'The message can be up to 200 characters.' });

  const lat = numberOrNull(latitude);
  const lng = numberOrNull(longitude);
  if ((lat === null) !== (lng === null)) return reply(400, { error: 'A location needs both a latitude and a longitude.' });

  const { data: started, error: startError } = await asCaller.rpc('start_sos_alert', {
    p_church: church_id,
    p_latitude: lat,
    p_longitude: lng,
    p_accuracy: numberOrNull(accuracy),
    p_message: text,
  });
  if (startError) {
    console.error('send-sos-alert start failed', startError);
    if (startError.code === '42501') return reply(403, { error: 'Only members of this church can send an alert.' });
    return reply(400, { error: startError.message });
  }
  const alert = started?.[0];
  if (!alert) return reply(500, { error: 'Could not send the alert.' });
  if (!alert.is_new) return reply(200, { alert_id: alert.alert_id, notified: 0, already_open: true });

  // Everyone approved in the church except the sender, on each device they've registered.
  let notified = 0;
  try {
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const [{ data: church }, { data: sender }, { data: members }] = await Promise.all([
      admin.from('churches').select('name').eq('id', church_id).single(),
      admin.from('profiles').select('full_name').eq('id', userId).single(),
      admin.from('memberships').select('user_id').eq('church_id', church_id).eq('status', 'approved').neq('user_id', userId),
    ]);
    const userIds = (members ?? []).map((m) => m.user_id as string);
    if (userIds.length > 0) {
      const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', userIds);
      const messages: PushMessage[] = (tokens ?? []).map((t) => ({
        to: t.token as string,
        title: `🚨 ${sender?.full_name ?? 'A member'}`,
        body: `SOS · ${church?.name ?? 'Your church'}`,
        sound: 'default',
        channelId: 'alerts',
        priority: 'high',
        interruptionLevel: 'time-sensitive',
        ttl: 3600,
        data: { type: 'sos', church_id, alert_id: alert.alert_id },
      }));
      const { accepted, dead } = await sendPush(messages);
      notified = accepted;
      if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);
    }
  } catch (e) {
    console.error('send-sos-alert push failed', e);
  }

  return reply(200, { alert_id: alert.alert_id, notified, already_open: false });
});
