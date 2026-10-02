-- Personal notes on Bible verses.
--
-- Anyone signed in can keep notes while they read. A note belongs to one person and nobody else can
-- read it: not their church, not its leaders. It is tied to a verse (book, chapter, verse) and not to a
-- translation, so it shows whichever translation the person is reading. One note per verse.
-- Notes go away with the account (profiles cascade from auth.users).

create table public.bible_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Book name as in bible-books.ts, like 'John' or 'Psalms'. The app checks it against its book list.
  book text not null check (char_length(book) between 1 and 40),
  chapter smallint not null check (chapter between 1 and 150),
  verse smallint not null check (verse between 1 and 176),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book, chapter, verse)
);

create index bible_notes_user_idx on public.bible_notes (user_id, book, chapter);

alter table public.bible_notes enable row level security;
revoke all on public.bible_notes from anon, authenticated;
grant select, insert, delete on public.bible_notes to authenticated;
grant update (body, updated_at) on public.bible_notes to authenticated;

create policy "bible_notes: read your own"
  on public.bible_notes for select to authenticated
  using (user_id = auth.uid());

create policy "bible_notes: write your own"
  on public.bible_notes for insert to authenticated
  with check (user_id = auth.uid());

create policy "bible_notes: edit your own"
  on public.bible_notes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "bible_notes: delete your own"
  on public.bible_notes for delete to authenticated
  using (user_id = auth.uid());
