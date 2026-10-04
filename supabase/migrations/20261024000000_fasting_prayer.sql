-- Fasting prayer timetable: on one Friday a month (the third, unless the Pastor chooses another) members take
-- half-hour prayer slots through the day, skipping the times the church already meets. Any number of people can take
-- the same slot, and a person can take as many slots as they like. Everyone in the church sees who is praying when.
--
-- The Pastor can change which Friday, the start and end of the day, and the breaks. Until they do, the defaults below
-- apply: the third Friday, 6 AM to midnight, without 10:30 to 11:30 AM and 7:30 to 9:30 PM.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

-- Breaks: a short list of {"start": "HH:MM", "end": "HH:MM"} with the start before the end.
create function public.fasting_breaks_valid(p_breaks jsonb)
returns boolean
language plpgsql immutable
as $$
declare
  v_item jsonb;
begin
  if jsonb_typeof(p_breaks) <> 'array' or jsonb_array_length(p_breaks) > 6 then
    return false;
  end if;
  for v_item in select * from jsonb_array_elements(p_breaks) loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(v_item ->> 'end', '') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
      or (v_item ->> 'start') >= (v_item ->> 'end') then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table public.fasting_settings (
  church_id uuid primary key references public.churches (id) on delete cascade,
  -- Which Friday of the month: 1 to 4.
  nth_friday smallint not null default 3 check (nth_friday between 1 and 4),
  start_time time not null default '06:00',
  -- '24:00' is midnight at the end of the day.
  end_time time not null default '24:00',
  breaks jsonb not null default '[{"start": "10:30", "end": "11:30"}, {"start": "19:30", "end": "21:30"}]'
    check (public.fasting_breaks_valid(breaks)),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint fasting_settings_day_in_order check (end_time > start_time),
  -- Half-hour slots line up from the start of the day.
  constraint fasting_settings_on_the_half_hour check (
    extract(minute from start_time)::int % 30 = 0 and extract(minute from end_time)::int % 30 = 0
  )
);

alter table public.fasting_settings enable row level security;
revoke all on public.fasting_settings from anon, authenticated;
grant select, insert on public.fasting_settings to authenticated;
grant update (nth_friday, start_time, end_time, breaks) on public.fasting_settings to authenticated;

create policy "fasting_settings: members read"
  on public.fasting_settings for select to authenticated
  using (public.is_church_member(church_id));
create policy "fasting_settings: the Pastor sets up"
  on public.fasting_settings for insert to authenticated
  with check (public.has_church_role(church_id, array['pastor']::public.member_role[]));
create policy "fasting_settings: the Pastor changes"
  on public.fasting_settings for update to authenticated
  using (public.has_church_role(church_id, array['pastor']::public.member_role[]))
  with check (public.has_church_role(church_id, array['pastor']::public.member_role[]));

create function public.touch_fasting_settings()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger fasting_settings_touch before insert or update on public.fasting_settings
  for each row execute function public.touch_fasting_settings();

-- ---------------------------------------------------------------------------
-- Is a slot one people can take?
-- ---------------------------------------------------------------------------

-- True when p_slot starts a half hour on the church's fasting Friday: inside the day, on the half hour, and not
-- overlapping a break. Uses the defaults when the Pastor has not set anything.
create function public.fasting_slot_ok(p_church uuid, p_day date, p_slot time)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_nth smallint := 3;
  v_start int := 6 * 60;
  v_end int := 24 * 60;
  v_breaks jsonb := '[{"start": "10:30", "end": "11:30"}, {"start": "19:30", "end": "21:30"}]';
  v_slot int;
  v_item jsonb;
  v_settings public.fasting_settings;
begin
  v_settings := (select s from public.fasting_settings s where s.church_id = p_church);
  if v_settings.church_id is not null then
    v_nth := v_settings.nth_friday;
    v_start := (extract(epoch from v_settings.start_time) / 60)::int;
    v_end := (extract(epoch from v_settings.end_time) / 60)::int;
    v_breaks := v_settings.breaks;
  end if;

  -- The nth Friday of its month.
  if extract(isodow from p_day) <> 5 or ceil(extract(day from p_day) / 7.0) <> v_nth then
    return false;
  end if;

  v_slot := (extract(epoch from p_slot) / 60)::int;
  if v_slot < v_start or v_slot + 30 > v_end or (v_slot - v_start) % 30 <> 0 then
    return false;
  end if;

  for v_item in select * from jsonb_array_elements(v_breaks) loop
    if v_slot < (extract(epoch from (v_item ->> 'end')::time) / 60)::int
      and v_slot + 30 > (extract(epoch from (v_item ->> 'start')::time) / 60)::int then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sign-ups
-- ---------------------------------------------------------------------------

create table public.fasting_signups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  day date not null,
  slot_start time not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (church_id, day, slot_start, user_id)
);

create index fasting_signups_day_idx on public.fasting_signups (church_id, day, slot_start);

-- Only a real slot, on a fasting Friday that has not passed.
create function public.check_fasting_signup()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.day < current_date - 1 then
    raise exception 'That fasting day has passed' using errcode = '23514';
  end if;
  if not public.fasting_slot_ok(new.church_id, new.day, new.slot_start) then
    raise exception 'That is not a prayer slot on the fasting day' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger fasting_signups_check before insert on public.fasting_signups
  for each row execute function public.check_fasting_signup();

alter table public.fasting_signups enable row level security;
revoke all on public.fasting_signups from anon, authenticated;
grant select, delete on public.fasting_signups to authenticated;
grant insert (church_id, day, slot_start, user_id) on public.fasting_signups to authenticated;

create policy "fasting_signups: members read"
  on public.fasting_signups for select to authenticated
  using (public.is_church_member(church_id));
create policy "fasting_signups: members take slots for themselves"
  on public.fasting_signups for insert to authenticated
  with check (public.is_church_member(church_id) and user_id = auth.uid());
-- People leave their own slots; leaders can tidy up anyone's.
create policy "fasting_signups: leave your own, or a leader removes"
  on public.fasting_signups for delete to authenticated
  using (user_id = auth.uid() or public.is_church_leader(church_id));

-- The day's timetable with names, for every member of the church.
create function public.fasting_timetable(p_church uuid, p_day date)
returns table (slot_start time, user_id uuid, full_name text, avatar_path text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_church_member(p_church) then
    return;
  end if;
  return query
  select s.slot_start, s.user_id, p.full_name, p.avatar_path
  from public.fasting_signups s
  join public.profiles p on p.id = s.user_id
  where s.church_id = p_church and s.day = p_day
  order by s.slot_start, s.created_at;
end;
$$;

revoke all on function public.fasting_slot_ok(uuid, date, time), public.fasting_timetable(uuid, date) from public, anon;
grant execute on function public.fasting_slot_ok(uuid, date, time), public.fasting_timetable(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- A switch for the Pastor, like every other feature
-- ---------------------------------------------------------------------------

create or replace function public.known_church_features()
returns text[]
language sql immutable
as $$
  select array[
    'bible', 'videos', 'bible_study', 'sermons', 'qa', 'prayer', 'polls', 'daily_verse', 'reports',
    'special_days', 'funds', 'fundraisers', 'announcements', 'worship', 'calendar', 'chat', 'messages', 'fasting'
  ];
$$;

notify pgrst, 'reload schema';
