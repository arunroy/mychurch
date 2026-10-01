// Sends a push notification for a message that was just sent.
//
// The app calls this after it saves a message. The caller must be the message's sender, so nobody can
// trigger notifications for messages they did not write. The push is best effort: if it fails the
// message is still delivered in the app.
//
// kind 'direct': a private message; the other person in the conversation is notified.
// kind 'elders': a message in an elders thread; the leaders are notified when the member writes,
//                and the member is notified when a leader replies.

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

const preview = (text: string) => (text.length > 140 ? `${text.slice(0, 137)}…` : text);

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
  const { kind, message_id } = input;
  if ((kind !== 'direct' && kind !== 'elders') || typeof message_id !== 'string') {
    return reply(400, { error: 'Say which message to notify about.' });
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    let recipients: string[] = [];
    let title = '';
    let body = '';
    let data: Record<string, unknown> = {};

    const { data: sender } = await admin.from('profiles').select('full_name').eq('id', userId).single();
    const senderName = sender?.full_name || 'Someone';

    if (kind === 'direct') {
      const { data: message } = await admin
        .from('messages')
        .select('sender_id, body, conversation_id')
        .eq('id', message_id)
        .single();
      if (!message || message.sender_id !== userId) return reply(403, { error: 'That is not your message.' });

      const { data: conversation } = await admin
        .from('conversations')
        .select('church_id, user_a, user_b')
        .eq('id', message.conversation_id)
        .single();
      if (!conversation) return reply(404, { error: 'No such conversation.' });

      const other = conversation.user_a === userId ? conversation.user_b : conversation.user_a;
      // Only people still approved in the church are told.
      const { data: stillIn } = await admin
        .from('memberships')
        .select('user_id')
        .eq('church_id', conversation.church_id)
        .eq('user_id', other)
        .eq('status', 'approved');
      recipients = (stillIn ?? []).map((m) => m.user_id as string);
      title = senderName;
      body = preview(message.body);
      data = { type: 'message', conversation_id: message.conversation_id };
    } else {
      const { data: message } = await admin
        .from('elder_messages')
        .select('sender_id, body, thread_id')
        .eq('id', message_id)
        .single();
      if (!message || message.sender_id !== userId) return reply(403, { error: 'That is not your message.' });

      const { data: thread } = await admin
        .from('elder_threads')
        .select('church_id, member_id')
        .eq('id', message.thread_id)
        .single();
      if (!thread) return reply(404, { error: 'No such thread.' });

      if (message.sender_id === thread.member_id) {
        const { data: leaders } = await admin
          .from('memberships')
          .select('user_id')
          .eq('church_id', thread.church_id)
          .eq('status', 'approved')
          .in('role', ['pastor', 'elder', 'admin'])
          .neq('user_id', userId);
        recipients = (leaders ?? []).map((m) => m.user_id as string);
        title = `${senderName} wrote to the elders`;
      } else {
        recipients = [thread.member_id as string];
        title = `${senderName} replied from the elders`;
      }
      body = preview(message.body);
      data = { type: 'elders', thread_id: message.thread_id };
    }

    if (recipients.length === 0) return reply(200, { notified: 0 });
    const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', recipients);
    const messages: PushMessage[] = (tokens ?? []).map((t) => ({
      to: t.token as string,
      title,
      body,
      sound: 'default',
      channelId: 'default',
      data,
    }));
    const { accepted, dead } = await sendPush(messages);
    if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);
    return reply(200, { notified: accepted });
  } catch (e) {
    console.error('notify-message failed', e);
    return reply(500, { error: 'Could not send the notification.' });
  }
});
