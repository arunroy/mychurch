-- SOS alerts: a member in danger alerts the whole church and shares where they are.
--
-- The alert is created by start_sos_alert (called by the send-sos-alert function, which then sends the push
-- notifications). The sender's app keeps the location fresh while the alert is open. When the alert ends,
-- because the person is safe, a leader ended it, or two hours passed, the coordinates are erased: only the
-- record of who sent it, when, and how it ended is kept, for the church leaders to review for 30 days.
--
-- Nobody writes to this table directly. Every change goes through the functions below, which check who is asking.

create table public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'safe', 'false_alarm', 'ended_by_leader', 'expired')),
  message text not null default '' check (char_length(message) <= 200),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  accuracy_m real check (accuracy_m >= 0),
  location_at timestamptz,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint sos_alerts_coordinates_together check ((latitude is null) = (longitude is null)),
  -- A location only exists while the alert is open.
  constraint sos_alerts_location_only_while_active check (
    status = 'active'
    or (latitude is null and longitude is null and accuracy_m is null and location_at is null)
  )
);

create index sos_alerts_church_started_idx on public.sos_alerts (church_id, started_at desc);
create index sos_alerts_sender_started_idx on public.sos_alerts (sender_id, started_at desc);

alter table public.sos_alerts enable row level security;
revoke all on public.sos_alerts from anon, authenticated;
grant select on public.sos_alerts to authenticated;

-- Members of the church read alerts that are open, or ended within the last day (their coordinates are gone by then).
create policy "sos_alerts: members read recent alerts"
  on public.sos_alerts for select to authenticated
  using (
    public.is_church_member(church_id)
    and (status = 'active' or ended_at > now() - interval '24 hours')
  );

-- Live updates for the screens that are open. Realtime applies the read policy above.
alter table public.sos_alerts replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sos_alerts;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

-- An alert nobody ended stops after two hours, and its location goes with it. Called by the functions below,
-- so no scheduled job is needed.
create function public.expire_sos_alerts()
returns void
language sql security definer set search_path = ''
as $$
  update public.sos_alerts
  set status = 'expired', ended_at = now(), latitude = null, longitude = null, accuracy_m = null, location_at = null
  where status = 'active' and started_at < now() - interval '2 hours';
$$;

revoke all on function public.expire_sos_alerts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sending, updating and ending an alert
-- ---------------------------------------------------------------------------

-- Starts an alert for the caller. If they already have one open, that one is returned and is_new is false, so
-- a retry never alerts the church twice. A person can start 3 alerts in 24 hours.
create function public.start_sos_alert(
  p_church uuid,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy real default null,
  p_message text default ''
)
returns table (alert_id uuid, is_new boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_existing uuid;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_church_member(p_church) then
    raise exception 'Only members of this church can send an alert' using errcode = '42501';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'A location needs both a latitude and a longitude';
  end if;
  if char_length(coalesce(p_message, '')) > 200 then
    raise exception 'The message can be up to 200 characters';
  end if;

  perform public.expire_sos_alerts();

  select a.id into v_existing
  from public.sos_alerts a
  where a.church_id = p_church and a.sender_id = auth.uid() and a.status = 'active';
  if v_existing is not null then
    return query select v_existing, false;
    return;
  end if;

  if (
    select count(*) from public.sos_alerts a
    where a.sender_id = auth.uid() and a.church_id = p_church and a.started_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'You can send up to 3 alerts a day';
  end if;

  insert into public.sos_alerts (church_id, sender_id, message, latitude, longitude, accuracy_m, location_at)
  values (
    p_church, auth.uid(), trim(coalesce(p_message, '')), p_latitude, p_longitude, p_accuracy,
    case when p_latitude is null then null else now() end
  )
  returning id into v_id;

  return query select v_id, true;
end;
$$;

-- The sender's app calls this while the alert is open to keep the location current.
create function public.update_sos_location(
  p_alert uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy real default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_latitude is null or p_longitude is null then
    raise exception 'A location needs both a latitude and a longitude';
  end if;
  update public.sos_alerts
  set latitude = p_latitude, longitude = p_longitude, accuracy_m = p_accuracy, location_at = now()
  where id = p_alert and sender_id = auth.uid() and status = 'active';
end;
$$;

-- Ends an alert and erases its location. The sender says safe or false_alarm; the Pastor and elders can also
-- end anyone's alert (ended_by_leader). Ending one that is already over does nothing.
create function public.end_sos_alert(p_alert uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
  v_sender uuid;
begin
  if p_reason not in ('safe', 'false_alarm', 'ended_by_leader') then
    raise exception 'Say whether the person is safe, or it was a false alarm';
  end if;
  select a.church_id, a.sender_id into v_church, v_sender from public.sos_alerts a where a.id = p_alert;
  if v_church is null then
    return;
  end if;

  if p_reason = 'ended_by_leader' then
    if not public.has_church_role(v_church, array['pastor', 'elder']::public.member_role[]) then
      raise exception 'Only the Pastor and elders can end someone else''s alert' using errcode = '42501';
    end if;
  elsif v_sender <> auth.uid() then
    raise exception 'Only the person who sent the alert can say they are safe' using errcode = '42501';
  end if;

  update public.sos_alerts
  set status = p_reason, ended_at = now(), latitude = null, longitude = null, accuracy_m = null, location_at = null
  where id = p_alert and status = 'active';
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading alerts
-- ---------------------------------------------------------------------------

-- The alerts that are open now, with who sent them and where they are, for every member of the church.
create function public.active_sos_alerts(p_church uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  sender_avatar_path text,
  message text,
  latitude double precision,
  longitude double precision,
  accuracy_m real,
  location_at timestamptz,
  started_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_church_member(p_church) then
    return;
  end if;
  perform public.expire_sos_alerts();
  return query
  select a.id, a.sender_id, p.full_name, p.avatar_path, a.message, a.latitude, a.longitude, a.accuracy_m, a.location_at, a.started_at
  from public.sos_alerts a
  join public.profiles p on p.id = a.sender_id
  where a.church_id = p_church and a.status = 'active'
  order by a.started_at desc;
end;
$$;

-- The last 30 days of alerts, for the Pastor and elders to review. Never includes a location.
create function public.sos_history(p_church uuid)
returns table (
  id uuid,
  sender_name text,
  status text,
  message text,
  started_at timestamptz,
  ended_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_church_role(p_church, array['pastor', 'elder']::public.member_role[]) then
    raise exception 'Only the Pastor and elders can see the alert history' using errcode = '42501';
  end if;
  perform public.expire_sos_alerts();
  return query
  select a.id, p.full_name, a.status, a.message, a.started_at, a.ended_at
  from public.sos_alerts a
  join public.profiles p on p.id = a.sender_id
  where a.church_id = p_church and a.started_at > now() - interval '30 days'
  order by a.started_at desc;
end;
$$;

revoke all on function
  public.start_sos_alert(uuid, double precision, double precision, real, text),
  public.update_sos_location(uuid, double precision, double precision, real),
  public.end_sos_alert(uuid, text), public.active_sos_alerts(uuid), public.sos_history(uuid)
  from public, anon;
grant execute on function
  public.start_sos_alert(uuid, double precision, double precision, real, text),
  public.update_sos_location(uuid, double precision, double precision, real),
  public.end_sos_alert(uuid, text), public.active_sos_alerts(uuid), public.sos_history(uuid)
  to authenticated;
