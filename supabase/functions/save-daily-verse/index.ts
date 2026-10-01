// Saves the Pastor's verse of the day.
//
// The caller sends a translation, book, chapter and verse range, never the verse text. This
// function checks the caller is the church's Pastor, checks the passage exists, fetches the text
// from bible-api.com and stores it. That is what stops verse text being typed or pasted in.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { displayBook, findTranslation, formatReference, isValidPassage } from '../_shared/bible-books.ts';

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

type Input = {
  church_id?: unknown;
  verse_date?: unknown;
  translation_code?: unknown;
  book?: unknown;
  chapter?: unknown;
  verse_start?: unknown;
  verse_end?: unknown;
  reflection?: unknown;
};

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return reply(401, { error: 'Sign in first.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  // The caller's own client: its JWT decides who they are, and RLS-aware helpers run as them.
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user) return reply(401, { error: 'Sign in first.' });
  const userId = userData.user.id;

  let input: Input;
  try {
    input = await request.json();
  } catch {
    return reply(400, { error: 'Send JSON.' });
  }

  const { church_id, verse_date, translation_code, book, chapter, verse_start, verse_end, reflection } = input;
  const translation = typeof translation_code === 'string' ? findTranslation(translation_code) : undefined;
  if (typeof church_id !== 'string' || !isDate(verse_date)) return reply(400, { error: 'Choose a day.' });
  if (!translation) return reply(400, { error: 'Choose one of the available translations.' });
  if (
    typeof book !== 'string' ||
    typeof chapter !== 'number' ||
    typeof verse_start !== 'number' ||
    typeof verse_end !== 'number' ||
    !isValidPassage(book, chapter, verse_start, verse_end)
  ) {
    return reply(400, { error: 'That book, chapter and verse combination does not exist.' });
  }
  const note = reflection === undefined ? '' : reflection;
  if (typeof note !== 'string' || note.length > 4000) return reply(400, { error: 'The reflection is too long.' });

  // Only the Pastor of this church may set the verse.
  const { data: isPastor, error: roleError } = await asCaller.rpc('has_church_role', {
    p_church: church_id,
    p_roles: ['pastor'],
  });
  if (roleError) {
    console.error('save-daily-verse role check failed', roleError);
    return reply(500, { error: `Could not check your role (${roleError.code ?? 'error'}).` });
  }
  if (!isPastor) return reply(403, { error: 'Only the Pastor can set the verse of the day.' });

  const reference = formatReference(displayBook(book), chapter, verse_start, verse_end);
  let text: string;
  try {
    const response = await fetch(
      `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation.code}`,
    );
    if (!response.ok) throw new Error(`bible-api ${response.status}`);
    const body: { text?: string } = await response.json();
    text = (body.text ?? '').replace(/\s+/g, ' ').trim();
  } catch {
    return reply(502, { error: 'The Bible text is unavailable right now. Try again in a moment.' });
  }
  if (!text || text.length > 4000) {
    return reply(422, { error: 'That passage is too long to use as the verse of the day. Choose fewer verses.' });
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin
    .from('daily_verses')
    .upsert(
      {
        church_id,
        verse_date,
        reference,
        verse_text: text,
        translation: translation.name,
        translation_code: translation.code,
        book,
        chapter,
        verse_start,
        verse_end,
        reflection: note.trim(),
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'church_id,verse_date' },
    )
    .select()
    .single();
  if (error) {
    console.error('save-daily-verse upsert failed', error);
    return reply(500, { error: `Could not save the verse (${error.code ?? 'database error'}).` });
  }
  return reply(200, { verse: data });
});
