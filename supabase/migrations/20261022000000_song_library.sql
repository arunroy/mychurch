-- Song library: the songs a church has used, so planners can pick them again instead of retyping.
--
-- Every song put in a Sunday plan is saved to the church's library automatically (by save_worship_plan, below).
-- Planners can also add, fix, tag and delete songs directly. The library is a planning tool: only the people who can
-- plan worship (the Pastor, elders and worship leaders) can read it. Members see songs only inside a plan.
-- How often and when a song was last sung is worked out from the plans, never typed in.

create function public.song_tags_valid(p_tags text[])
returns boolean
language sql immutable
as $$
  select coalesce(cardinality(p_tags), 0) <= 5
    and not exists (
      select 1 from unnest(p_tags) as t
      where t is null or char_length(t) not between 1 and 24 or t <> lower(trim(t))
    );
$$;

create table public.church_songs (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  artist text not null default '' check (char_length(artist) <= 100),
  link text not null default '' check (link = '' or (char_length(link) <= 500 and link ~* '^https?://[^\s]+$')),
  language text not null default 'other' check (language in ('en', 'hi', 'ta', 'ml', 'kn', 'other')),
  tags text[] not null default '{}' check (public.song_tags_valid(tags)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- The same song is never in a church's library twice.
create unique index church_songs_unique_idx on public.church_songs (church_id, lower(title), lower(artist));
create index church_songs_church_idx on public.church_songs (church_id, created_at desc);

alter table public.worship_songs add column song_id uuid references public.church_songs (id) on delete set null;
create index worship_songs_song_idx on public.worship_songs (song_id);

-- Songs already in plans join the library.
insert into public.church_songs (church_id, title, artist, link)
select distinct on (church_id, lower(title), lower(artist)) church_id, title, artist, link
from public.worship_songs
order by church_id, lower(title), lower(artist), position
on conflict do nothing;

update public.worship_songs ws set song_id = s.id
from public.church_songs s
where s.church_id = ws.church_id and lower(s.title) = lower(ws.title) and lower(s.artist) = lower(ws.artist);

-- ---------------------------------------------------------------------------
-- Who can do what
-- ---------------------------------------------------------------------------

alter table public.church_songs enable row level security;
revoke all on public.church_songs from anon, authenticated;
grant select, delete on public.church_songs to authenticated;
grant insert (church_id, title, artist, link, language, tags, created_by) on public.church_songs to authenticated;
grant update (title, artist, link, language, tags) on public.church_songs to authenticated;

create policy "church_songs: planners read"
  on public.church_songs for select to authenticated
  using (public.can_plan_worship(church_id));
create policy "church_songs: planners add in their own name"
  on public.church_songs for insert to authenticated
  with check (public.can_plan_worship(church_id) and created_by = auth.uid());
create policy "church_songs: planners change"
  on public.church_songs for update to authenticated
  using (public.can_plan_worship(church_id)) with check (public.can_plan_worship(church_id));
create policy "church_songs: planners delete"
  on public.church_songs for delete to authenticated
  using (public.can_plan_worship(church_id));

-- ---------------------------------------------------------------------------
-- The library with how often and when each song was sung
-- ---------------------------------------------------------------------------

-- Plans dated today or earlier count as sung; later ones show as next planned.
create function public.song_library(p_church uuid)
returns table (
  id uuid,
  title text,
  artist text,
  link text,
  language text,
  tags text[],
  times_sung bigint,
  last_sung date,
  next_planned date
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_plan_worship(p_church) then
    raise exception 'Only the Pastor, elders and worship leaders can see the song library' using errcode = '42501';
  end if;
  return query
  select
    s.id, s.title, s.artist, s.link, s.language, s.tags,
    count(distinct p.id) filter (where p.service_date <= current_date),
    max(p.service_date) filter (where p.service_date <= current_date),
    min(p.service_date) filter (where p.service_date > current_date)
  from public.church_songs s
  left join public.worship_songs ws on ws.song_id = s.id
  left join public.worship_plans p on p.id = ws.plan_id
  where s.church_id = p_church
  group by s.id
  order by lower(s.title);
end;
$$;

-- ---------------------------------------------------------------------------
-- Saving a plan also saves its songs to the library
-- ---------------------------------------------------------------------------

drop function public.save_worship_plan(uuid, date, int, int, int, text, jsonb);

-- p_songs is a JSON array of { "title", "artist", "link", "language", "tags" } in the order they will be sung.
-- A song is matched to the library by title and artist; what is given (link, language, tags) updates it.
create function public.save_worship_plan(
  p_church uuid,
  p_date date,
  p_chapter int,
  p_verse_start int,
  p_verse_end int,
  p_note text,
  p_songs jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_song jsonb;
  v_position int := 0;
  v_reference text := '';
  v_title text;
  v_artist text;
  v_link text;
  v_language text;
  v_tags text[];
  v_song_id uuid;
begin
  if auth.uid() is null or not public.can_plan_worship(p_church) then
    raise exception 'Only the Pastor, elders and worship leaders can plan worship' using errcode = '42501';
  end if;
  if p_date is null or extract(dow from p_date) <> 0 then
    raise exception 'Worship is planned for a Sunday';
  end if;
  if p_songs is null or jsonb_typeof(p_songs) <> 'array' then
    raise exception 'The songs must be a list';
  end if;
  if jsonb_array_length(p_songs) > 12 then
    raise exception 'A Sunday can have up to 12 songs';
  end if;
  if p_chapter is not null then
    if p_verse_start is null then
      raise exception 'Choose the verses of the Psalm';
    end if;
    v_reference := 'Psalm ' || p_chapter || ':' || p_verse_start
      || case when coalesce(p_verse_end, p_verse_start) > p_verse_start then '-' || p_verse_end else '' end;
  end if;

  insert into public.worship_plans (
    church_id, service_date, psalm_chapter, psalm_verse_start, psalm_verse_end, psalm_reference, note, created_by, updated_by
  )
  values (
    p_church, p_date, p_chapter, case when p_chapter is null then null else p_verse_start end,
    case when p_chapter is null then null else coalesce(p_verse_end, p_verse_start) end,
    v_reference, trim(coalesce(p_note, '')), auth.uid(), auth.uid()
  )
  on conflict (church_id, service_date) do update
    set psalm_chapter = excluded.psalm_chapter, psalm_verse_start = excluded.psalm_verse_start,
        psalm_verse_end = excluded.psalm_verse_end, psalm_reference = excluded.psalm_reference,
        note = excluded.note, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;

  delete from public.worship_songs where plan_id = v_id;
  for v_song in select * from jsonb_array_elements(p_songs) loop
    v_position := v_position + 1;
    v_title := trim(coalesce(v_song ->> 'title', ''));
    v_artist := trim(coalesce(v_song ->> 'artist', ''));
    v_link := trim(coalesce(v_song ->> 'link', ''));
    v_language := nullif(trim(coalesce(v_song ->> 'language', '')), '');
    -- Tags are kept lower-case, without repeats, five at most.
    v_tags := case
      when jsonb_typeof(v_song -> 'tags') = 'array' then (
        select coalesce(array_agg(t order by first_seen), '{}')
        from (
          select lower(trim(value)) as t, min(ord) as first_seen
          from jsonb_array_elements_text(v_song -> 'tags') with ordinality as e(value, ord)
          where trim(value) <> ''
          group by lower(trim(value))
        ) tags
      )
      else null
    end;
    if v_tags is not null then
      v_tags := v_tags[1:5];
    end if;

    -- The song is added to the library, or the existing one is brought up to date with what was given.
    insert into public.church_songs (church_id, title, artist, link, language, tags, created_by)
    values (p_church, v_title, v_artist, v_link, coalesce(v_language, 'other'), coalesce(v_tags, '{}'), auth.uid())
    on conflict (church_id, lower(title), lower(artist)) do update
      set link = case when v_link <> '' then v_link else public.church_songs.link end,
          language = coalesce(v_language, public.church_songs.language),
          tags = coalesce(v_tags, public.church_songs.tags)
    returning id into v_song_id;

    insert into public.worship_songs (plan_id, church_id, position, title, artist, link, song_id)
    values (v_id, p_church, v_position, v_title, v_artist, v_link, v_song_id);
  end loop;

  return v_id;
end;
$$;

revoke all on function public.song_library(uuid), public.save_worship_plan(uuid, date, int, int, int, text, jsonb)
  from public, anon;
grant execute on function public.song_library(uuid), public.save_worship_plan(uuid, date, int, int, int, text, jsonb)
  to authenticated;
