-- Sermons: a list of sermons with links, not the sermon text.
--
-- Church leaders (the Pastor, elders and admins) add a sermon with a link to read it (for example
-- on SermonCentral) and/or a link to a video or audio. Members open the links. The app stores no
-- sermon text: sermons belong to their authors, and sites like SermonCentral do not allow their
-- text to be republished. A sermon can be kept as a draft until a leader publishes it.

create table public.sermons (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 150),
  speaker text not null default '' check (char_length(speaker) <= 100),
  sermon_date date not null,
  -- The main passage as it is shown, such as "John 3:16-18"; the parts below are kept so it can be edited.
  reference text not null default '' check (char_length(reference) <= 100),
  book text,
  chapter integer check (chapter >= 1),
  verse_start integer check (verse_start >= 1),
  verse_end integer,
  read_url text check (read_url ~ '^https?://' and char_length(read_url) <= 500),
  media_url text check (media_url ~ '^https?://' and char_length(media_url) <= 500),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sermons_has_link check (read_url is not null or media_url is not null),
  constraint sermons_verse_range check (verse_end is null or verse_end >= verse_start)
);

create index sermons_church_date_idx on public.sermons (church_id, sermon_date desc);

alter table public.sermons enable row level security;
revoke all on public.sermons from anon, authenticated;
grant select, insert, delete on public.sermons to authenticated;
grant update (title, speaker, sermon_date, reference, book, chapter, verse_start, verse_end, read_url, media_url, published, updated_at)
  on public.sermons to authenticated;

create policy "sermons: members read the published ones"
  on public.sermons for select to authenticated
  using (published and public.is_church_member(church_id));

create policy "sermons: leaders read everything, drafts included"
  on public.sermons for select to authenticated
  using (public.is_church_leader(church_id));

create policy "sermons: leaders add in their own name"
  on public.sermons for insert to authenticated
  with check (created_by = auth.uid() and public.is_church_leader(church_id));

create policy "sermons: leaders edit"
  on public.sermons for update to authenticated
  using (public.is_church_leader(church_id))
  with check (public.is_church_leader(church_id));

create policy "sermons: leaders remove"
  on public.sermons for delete to authenticated
  using (public.is_church_leader(church_id));
