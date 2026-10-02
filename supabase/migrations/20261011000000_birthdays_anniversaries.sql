-- Birthdays and anniversaries.
--
-- Members can add their own birthday (month and day, never the year) to their profile. Leaders
-- (Pastor, elders, church admins) can add and delete birthdays and anniversaries for the church,
-- for people who haven't added theirs or who are not in the app. Everyone in the church sees the
-- combined list on Home, through church_special_days.

-- ---------------------------------------------------------------------------
-- A member's own birthday
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_day smallint check (birth_day between 1 and 31),
  add constraint profiles_birthday_valid check (
    (birth_month is null and birth_day is null)
    or (birth_month is not null and birth_day is not null
        and birth_day <= (array[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])[birth_month])
  );

grant update (birth_month, birth_day) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Dates a leader adds
-- ---------------------------------------------------------------------------

create table public.special_days (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  kind text not null check (kind in ('birthday', 'anniversary')),
  -- Who it is for: "Mary Okafor", or "John and Ruth Mensah" for an anniversary.
  name text not null check (char_length(trim(name)) between 1 and 100),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  -- Optional, so an anniversary can say "25 years". Never used for birthdays.
  year smallint check (year between 1900 and 2100),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint special_days_date_valid
    check (day <= (array[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])[month]),
  constraint special_days_year_anniversaries_only check (year is null or kind = 'anniversary')
);

create index special_days_church_idx on public.special_days (church_id);

alter table public.special_days enable row level security;
revoke all on public.special_days from anon, authenticated;
grant select, insert, delete on public.special_days to authenticated;

create policy "special_days: members read"
  on public.special_days for select to authenticated
  using (public.is_church_member(church_id));

create policy "special_days: leaders add in their own name"
  on public.special_days for insert to authenticated
  with check (created_by = auth.uid() and public.is_church_leader(church_id));

create policy "special_days: leaders delete"
  on public.special_days for delete to authenticated
  using (public.is_church_leader(church_id));

-- ---------------------------------------------------------------------------
-- The combined list
-- ---------------------------------------------------------------------------

-- Every birthday and anniversary in a church: the ones leaders added (source 'added', deletable
-- by leaders) and the ones members put on their own profile (source 'member', theirs to change).
-- A member who has hidden themselves from the directory is left out.
create function public.church_special_days(p_church uuid)
returns table (
  id uuid,
  source text,
  kind text,
  name text,
  month smallint,
  day smallint,
  year smallint,
  user_id uuid,
  avatar_path text
)
language sql stable security definer set search_path = ''
as $$
  select s.id, 'added', s.kind, s.name, s.month, s.day, s.year, null::uuid, null::text
  from public.special_days s
  where s.church_id = p_church and public.is_church_member(p_church)
  union all
  select p.id, 'member', 'birthday', p.full_name, p.birth_month, p.birth_day, null::smallint, p.id, p.avatar_path
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.church_id = p_church and m.status = 'approved' and m.directory_visible
    and p.birth_month is not null and p.full_name <> ''
    and public.is_church_member(p_church);
$$;

revoke all on function public.church_special_days(uuid) from public, anon;
grant execute on function public.church_special_days(uuid) to authenticated;
