// Deletes the caller's account and the personal data tied to it.
//
// The app asks for this in More, Delete my account (both app stores require it). It refuses when the caller is
// the only Pastor of a church that still has other members, so a church is never left without a Pastor. A
// church with nobody else in it is deleted along with the account.
//
// Order: check first, delete files and the few things the database would otherwise leave behind, and only then
// delete the sign-in user. Deleting the user removes the profile and everything that belongs to it through the
// database's cascades (memberships, messages, chat, prayer requests, polls and votes, RSVPs, tokens...).

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
  if (input.confirm !== 'DELETE') return reply(400, { error: 'Type DELETE to confirm.' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // 1. A church must not be left without a Pastor.
    const { data: pastorships, error: pastorError } = await admin
      .from('memberships')
      .select('church_id, churches(name)')
      .eq('user_id', userId)
      .eq('role', 'pastor')
      .eq('status', 'approved');
    if (pastorError) throw pastorError;

    const blocking: string[] = [];
    const emptyChurches: string[] = [];
    for (const pastorship of pastorships ?? []) {
      const churchId = pastorship.church_id as string;
      const { count: otherPastors } = await admin
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('church_id', churchId)
        .eq('role', 'pastor')
        .eq('status', 'approved')
        .neq('user_id', userId);
      if ((otherPastors ?? 0) > 0) continue;

      const { count: others } = await admin
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('church_id', churchId)
        .neq('user_id', userId);
      if ((others ?? 0) === 0) {
        emptyChurches.push(churchId);
      } else {
        const church = pastorship.churches as { name?: string } | { name?: string }[] | null;
        const name = Array.isArray(church) ? church[0]?.name : church?.name;
        blocking.push(name || 'your church');
      }
    }
    if (blocking.length > 0) {
      return reply(409, {
        error: `You are the only Pastor of ${blocking.join(' and ')}. Make someone else Pastor first, then you can delete your account.`,
      });
    }

    // 2. Files: the profile photo, and the logo of a church that is going away with its last member.
    const removeFolder = async (bucket: string, folder: string) => {
      const { data: files } = await admin.storage.from(bucket).list(folder, { limit: 100 });
      if (files && files.length > 0) await admin.storage.from(bucket).remove(files.map((f) => `${folder}/${f.name}`));
    };
    await removeFolder('avatars', userId);
    for (const churchId of emptyChurches) await removeFolder('church-logos', churchId);

    // 3. What the database would leave behind with only the author cleared: the articles and links they
    //    submitted, and reports about what they wrote.
    const { error: sermonError } = await admin.from('sermons').delete().eq('created_by', userId).neq('source', 'pastor');
    if (sermonError) throw sermonError;
    const { error: reportError } = await admin.from('content_reports').delete().eq('target_user_id', userId);
    if (reportError) throw reportError;

    // 4. A church with nobody else in it goes with its last member.
    if (emptyChurches.length > 0) {
      const { error: churchError } = await admin.from('churches').delete().in('id', emptyChurches);
      if (churchError) throw churchError;
    }

    // 5. The sign-in user. Everything that belongs to the profile goes with it.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return reply(200, { deleted: true });
  } catch (e) {
    console.error('delete-account failed', e);
    return reply(500, { error: 'Could not delete your account. Please try again, or contact us.' });
  }
});
