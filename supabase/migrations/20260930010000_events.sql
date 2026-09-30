-- Phase 1: the church calendar.
--
-- One shared calendar per church. Any approved member can add an event. Changing
-- or removing an event is for whoever added it, plus church leaders (the Pastor,
-- elders and church admins) who look after everyone's.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  location text not null default '' check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at > starts_at),
  -- Set null if the creator's account goes away; the event then belongs to the leaders.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_church_starts_idx on public.events (church_id, starts_at);

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select, insert, delete on public.events to authenticated;
grant update (title, description, location, starts_at, ends_at, updated_at) on public.events to authenticated;

create function public.can_manage_event(p_church uuid, p_creator uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_church_leader(p_church) or (p_creator is not null and p_creator = auth.uid());
$$;

revoke execute on function public.can_manage_event(uuid, uuid) from public, anon;
grant execute on function public.can_manage_event(uuid, uuid) to authenticated;

create policy "events: everyone in the church sees the calendar"
  on public.events for select to authenticated
  using (public.is_church_member(church_id));

create policy "events: any member adds an event"
  on public.events for insert to authenticated
  with check (public.is_church_member(church_id) and created_by = auth.uid());

create policy "events: the creator or a leader edits"
  on public.events for update to authenticated
  using (public.is_church_member(church_id) and public.can_manage_event(church_id, created_by))
  with check (public.is_church_member(church_id) and public.can_manage_event(church_id, created_by));

create policy "events: the creator or a leader deletes"
  on public.events for delete to authenticated
  using (public.is_church_member(church_id) and public.can_manage_event(church_id, created_by));
