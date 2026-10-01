-- RSVPs for calendar events.
--
-- Any approved member of the church can say Going, Maybe or Can't go for an event, and change their
-- mind. Everyone sees the totals. Only the person who added the event, and church leaders, also see
-- who answered what. The table is closed to direct access; everything goes through the functions.

create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_rsvps enable row level security;
revoke all on public.event_rsvps from anon, authenticated;

-- Sets the caller's answer for an event. A null answer takes their RSVP back.
create function public.set_rsvp(p_event uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select church_id into v_church from public.events where id = p_event;
  if v_church is null or not public.is_church_member(v_church) then
    raise exception 'This event isn''t available' using errcode = '42501';
  end if;

  if p_status is null then
    delete from public.event_rsvps where event_id = p_event and user_id = auth.uid();
    return;
  end if;
  if p_status not in ('going', 'maybe', 'no') then
    raise exception 'Choose Going, Maybe or Can''t go';
  end if;

  insert into public.event_rsvps (event_id, user_id, status)
  values (p_event, auth.uid(), p_status)
  on conflict (event_id, user_id) do update set status = excluded.status, updated_at = now();
end;
$$;

-- Totals for everyone, the caller's own answer, and (for the event's creator and leaders) who answered what.
create function public.event_rsvp_summary(p_event uuid)
returns table (going integer, maybe integer, declined integer, my_status text, people jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event;
  if not found or not public.is_church_member(v_event.church_id) then
    raise exception 'This event isn''t available' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::integer from public.event_rsvps r where r.event_id = p_event and r.status = 'going'),
    (select count(*)::integer from public.event_rsvps r where r.event_id = p_event and r.status = 'maybe'),
    (select count(*)::integer from public.event_rsvps r where r.event_id = p_event and r.status = 'no'),
    (select r.status from public.event_rsvps r where r.event_id = p_event and r.user_id = auth.uid()),
    case
      when v_event.created_by = auth.uid() or public.is_church_leader(v_event.church_id)
      then (
        select coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'status', r.status) order by p.full_name), '[]'::jsonb)
        from public.event_rsvps r
        join public.profiles p on p.id = r.user_id
        where r.event_id = p_event
      )
    end;
end;
$$;

revoke execute on function public.set_rsvp(uuid, text), public.event_rsvp_summary(uuid) from public, anon;
grant execute on function public.set_rsvp(uuid, text), public.event_rsvp_summary(uuid) to authenticated;
