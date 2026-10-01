-- The Pastor now picks a verse (translation, book, chapter, verses) instead of typing it.
--
-- The text is fetched and saved by the save-daily-verse function, which runs with the service
-- role. Signed-in users can no longer insert or update daily_verses directly, so nobody can
-- store text that didn't come from a Bible. Reading and deleting work as before.

alter table public.daily_verses
  add column book text,
  add column chapter integer check (chapter >= 1),
  add column verse_start integer check (verse_start >= 1),
  add column verse_end integer,
  add column translation_code text check (translation_code in ('web', 'kjv', 'asv', 'bbe')),
  add constraint daily_verses_verse_range check (verse_end is null or verse_end >= verse_start);

drop policy "daily verses: the Pastor writes" on public.daily_verses;
drop policy "daily verses: the Pastor edits" on public.daily_verses;

revoke insert, update on public.daily_verses from authenticated;
revoke update (reference, verse_text, translation, reflection, updated_at) on public.daily_verses from authenticated;
