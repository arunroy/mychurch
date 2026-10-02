-- Sunday worship plans: the Psalm and the songs for a Sunday, so members can prepare.
--
-- The Pastor, the elders and anyone the Pastor marks as a Worship leader can plan worship. Everyone approved in the
-- church can read the plans. Plans are written only through save_worship_plan, so a plan and its songs are always saved
-- together. A Worship leader is a switch on the membership, not a role, so an elder can also lead worship.

alter table public.memberships add column is_worship_leader boolean not null default false;

-- Only a Pastor turns the switch on or off, and only for approved members of their own church.
create function public.set_worship_leader(p_church uuid, p_user uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_church_role(p_church, array['pastor']::public.member_role[]) then
    raise exception 'Only a Pastor can choose the worship leaders' using errcode = '42501';
  end if;
  update public.memberships set is_worship_leader = coalesce(p_value, false)
  where church_id = p_church and user_id = p_user and status = 'approved';
  if not found then
    raise exception 'Approve this person before making them a worship leader' using errcode = 'P0002';
  end if;
end;
$$;

create function public.can_plan_worship(p_church uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where church_id = p_church and user_id = auth.uid() and status = 'approved'
      and (role in ('pastor', 'elder') or is_worship_leader)
  );
$$;

create table public.worship_plans (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  -- The Sunday this is for.
  service_date date not null,
  -- The Psalm, optional. The book is always Psalms.
  psalm_chapter int check (psalm_chapter between 1 and 150),
  psalm_verse_start int check (psalm_verse_start >= 1),
  psalm_verse_end int,
  psalm_reference text not null default '',
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (church_id, service_date),
  unique (id, church_id),
  constraint worship_plans_psalm_together check (
    (psalm_chapter is null) = (psalm_verse_start is null) and (psalm_chapter is null) = (psalm_verse_end is null)
  ),
  constraint worship_plans_verses_in_order check (psalm_verse_end is null or psalm_verse_end >= psalm_verse_start)
);

create table public.worship_songs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  church_id uuid not null,
  position int not null check (position >= 1),
  title text not null check (char_length(trim(title)) between 1 and 120),
  artist text not null default '' check (char_length(artist) <= 100),
  -- Where to listen and practise. Only web links.
  link text not null default '' check (link = '' or (char_length(link) <= 500 and link ~* '^https?://[^\s]+$')),
  foreign key (plan_id, church_id) references public.worship_plans (id, church_id) on delete cascade
);

create index worship_songs_plan_idx on public.worship_songs (plan_id, position);

alter table public.worship_plans enable row level security;
alter table public.worship_songs enable row level security;
revoke all on public.worship_plans, public.worship_songs from anon, authenticated;
grant select on public.worship_plans, public.worship_songs to authenticated;
grant delete on public.worship_plans to authenticated;

create policy "worship_plans: members read"
  on public.worship_plans for select to authenticated
  using (public.is_church_member(church_id));
create policy "worship_plans: planners delete"
  on public.worship_plans for delete to authenticated
  using (public.can_plan_worship(church_id));
create policy "worship_songs: members read"
  on public.worship_songs for select to authenticated
  using (public.is_church_member(church_id));

-- Saves the plan for a Sunday with all its songs, replacing what was there. p_songs is a JSON array of
-- { "title": "...", "artist": "...", "link": "..." } in the order they will be sung. A null chapter means no Psalm.
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
    insert into public.worship_songs (plan_id, church_id, position, title, artist, link)
    values (
      v_id, p_church, v_position,
      trim(coalesce(v_song ->> 'title', '')), trim(coalesce(v_song ->> 'artist', '')), trim(coalesce(v_song ->> 'link', ''))
    );
  end loop;

  return v_id;
end;
$$;

revoke all on function public.set_worship_leader(uuid, uuid, boolean), public.can_plan_worship(uuid),
  public.save_worship_plan(uuid, date, int, int, int, text, jsonb) from public, anon;
grant execute on function public.set_worship_leader(uuid, uuid, boolean), public.can_plan_worship(uuid),
  public.save_worship_plan(uuid, date, int, int, int, text, jsonb) to authenticated;
