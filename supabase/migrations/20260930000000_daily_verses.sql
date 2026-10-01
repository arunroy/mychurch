-- Phase 1: the daily verse and reflection.
--
-- The Pastor picks one verse per day, and can write it ahead of time. Everyone
-- approved in the church reads it; only the Pastor writes it.

create table public.daily_verses (
  church_id uuid not null references public.churches (id) on delete cascade,
  verse_date date not null,
  reference text not null check (char_length(trim(reference)) between 1 and 100),
  verse_text text not null check (char_length(trim(verse_text)) between 1 and 4000),
  translation text not null default '' check (char_length(translation) <= 60),
  reflection text not null default '' check (char_length(reflection) <= 4000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (church_id, verse_date)
);

alter table public.daily_verses enable row level security;
revoke all on public.daily_verses from anon, authenticated;
grant select, insert, delete on public.daily_verses to authenticated;
grant update (reference, verse_text, translation, reflection, updated_at) on public.daily_verses to authenticated;

-- Members can't peek at verses scheduled for later. Dates have no time zone, so
-- allow up to the furthest-ahead zone (UTC+14): the app then shows only today's.
create policy "daily verses: members read what is due"
  on public.daily_verses for select to authenticated
  using (
    public.is_church_member(church_id)
    and verse_date <= ((now() at time zone 'utc') + interval '14 hours')::date
  );

create policy "daily verses: the Pastor reads everything, including scheduled"
  on public.daily_verses for select to authenticated
  using (public.has_church_role(church_id, array['pastor']::public.member_role[]));

create policy "daily verses: the Pastor writes"
  on public.daily_verses for insert to authenticated
  with check (
    public.has_church_role(church_id, array['pastor']::public.member_role[])
    and created_by = auth.uid()
  );

create policy "daily verses: the Pastor edits"
  on public.daily_verses for update to authenticated
  using (public.has_church_role(church_id, array['pastor']::public.member_role[]))
  with check (public.has_church_role(church_id, array['pastor']::public.member_role[]));

create policy "daily verses: the Pastor deletes"
  on public.daily_verses for delete to authenticated
  using (public.has_church_role(church_id, array['pastor']::public.member_role[]));
