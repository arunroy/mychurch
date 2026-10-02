-- SOS alerts: members alert their church and share a location that is erased when the alert ends.

\set pastor_a '''aaaaaaaa-0000-0000-0010-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0010-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0010-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0010-000000000003'''
\set member_b '''aaaaaaaa-0000-0000-0010-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0010-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'soa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'sob@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'soe@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'som@example.com', '{"full_name": "Mary Member"}'),
  (:member_b, 'sob2@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'sop@example.com', '{"full_name": "Pat Pending"}');

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  execute 'set role authenticated';
end $$;

create function pg_temp.check(p_ok boolean, p_what text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAILED: %', p_what;
  end if;
  raise notice 'ok - %', p_what;
end $$;

create function pg_temp.fails(p_sql text, p_what text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok - % (%)', p_what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: expected an error: %', p_what;
end $$;

create function pg_temp.count_of(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
end $$;

set client_min_messages = notice;

select pg_temp.act_as(:pastor_a);
select public.register_church('SOS Church A', 'Springfield', 'a@sos.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('SOS Church B', 'Shelbyville', 'b@sos.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_b, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Starting an alert
select pg_temp.act_as(:member_a);
select alert_id as alert1, is_new as new1 from public.start_sos_alert(:'church_a', 51.5074, -0.1278, 12.5, 'Near the station') \gset
select pg_temp.check(:'new1'::boolean, 'a member can start an alert');
select pg_temp.check((select is_new = false and alert_id = :'alert1' from public.start_sos_alert(:'church_a')), 'starting again returns the open alert instead of a second one');
select pg_temp.fails(format('select * from public.start_sos_alert(%L, 95, 0)', :'church_a'), 'a latitude must be a real one');
select pg_temp.fails(format('select * from public.start_sos_alert(%L, 51.5, null)', :'church_a'), 'a location needs both coordinates');
select pg_temp.fails('insert into public.sos_alerts (church_id, sender_id) select church_id, user_id from public.memberships limit 1', 'alerts cannot be inserted directly');
select pg_temp.fails('update public.sos_alerts set latitude = 0', 'or changed directly');
reset role;

-- Who can see it
select pg_temp.act_as(:member_b);
select pg_temp.check((select count(*) = 1 and bool_and(sender_name = 'Mary Member' and latitude = 51.5074 and message = 'Near the station') from public.active_sos_alerts(:'church_a')), 'every member sees the open alert, its sender and its location');
select pg_temp.check(pg_temp.count_of('select * from public.sos_alerts') = 1, 'and can read it from the table');
reset role;

select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.active_sos_alerts(%L)', :'church_a')) = 0, 'someone waiting for approval sees none');
select pg_temp.check(pg_temp.count_of('select * from public.sos_alerts') = 0, 'not from the table either');
select pg_temp.fails(format('select * from public.start_sos_alert(%L)', :'church_a'), 'and cannot send one');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of(format('select * from public.active_sos_alerts(%L)', :'church_a')) = 0, 'another church sees none');
select pg_temp.fails(format('select * from public.start_sos_alert(%L)', :'church_a'), 'and cannot send one here');
reset role;

set role anon;
select pg_temp.fails(format('select * from public.active_sos_alerts(%L)', :'church_a'), 'signed-out visitors cannot read alerts');
reset role;

-- The location follows the sender, and only the sender
select pg_temp.act_as(:member_b);
select public.update_sos_location(:'alert1', 0, 0);
reset role;
select pg_temp.check((select latitude = 51.5074 from public.sos_alerts where id = :'alert1'), 'someone else cannot move the location');

select pg_temp.act_as(:member_a);
select public.update_sos_location(:'alert1', 51.5100, -0.1300, 8);
select pg_temp.check((select latitude = 51.51 and longitude = -0.13 and accuracy_m = 8 and location_at is not null from public.sos_alerts where id = :'alert1'), 'the sender keeps the location current');
reset role;

-- Ending an alert erases the location
select pg_temp.act_as(:member_b);
select pg_temp.fails(format('select public.end_sos_alert(%L, ''safe'')', :'alert1'), 'someone else cannot say the sender is safe');
select pg_temp.fails(format('select public.end_sos_alert(%L, ''ended_by_leader'')', :'alert1'), 'a member cannot end it as a leader');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.end_sos_alert(%L, ''because'')', :'alert1'), 'the reason has to be one we know');
select public.end_sos_alert(:'alert1', 'safe');
select public.update_sos_location(:'alert1', 1, 1);
reset role;
select pg_temp.check((select status = 'safe' and ended_at is not null and latitude is null and longitude is null and accuracy_m is null and location_at is null from public.sos_alerts where id = :'alert1'), 'ending it marks it safe and erases the location');
select pg_temp.check((select latitude is null from public.sos_alerts where id = :'alert1'), 'and a late update cannot bring the location back');
select pg_temp.check(pg_temp.count_of('select * from public.sos_alerts where status = ''active''') = 0, 'nothing is open');

-- Three a day
select pg_temp.act_as(:member_a);
select alert_id as alert2 from public.start_sos_alert(:'church_a', 51.5, -0.1) \gset
select public.end_sos_alert(:'alert2', 'false_alarm');
select alert_id as alert3 from public.start_sos_alert(:'church_a') \gset
select public.end_sos_alert(:'alert3', 'safe');
select pg_temp.fails(format('select * from public.start_sos_alert(%L)', :'church_a'), 'a fourth alert in a day is refused');
reset role;

-- A leader can end someone else's alert
select pg_temp.act_as(:member_b);
select alert_id as alert4 from public.start_sos_alert(:'church_a', 51.6, -0.2) \gset
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.end_sos_alert(%L, ''safe'')', :'alert4'), 'a leader cannot say someone else is safe');
select public.end_sos_alert(:'alert4', 'ended_by_leader');
reset role;
select pg_temp.check((select status = 'ended_by_leader' and latitude is null from public.sos_alerts where id = :'alert4'), 'but can end it, which erases the location');

-- Alerts nobody ends stop after two hours
select pg_temp.act_as(:elder_a);
select alert_id as alert5 from public.start_sos_alert(:'church_a', 51.7, -0.3) \gset
reset role;
update public.sos_alerts set started_at = now() - interval '3 hours' where id = :'alert5';
select pg_temp.act_as(:member_b);
select pg_temp.check(pg_temp.count_of(format('select * from public.active_sos_alerts(%L)', :'church_a')) = 0, 'an alert older than two hours is no longer open');
reset role;
select pg_temp.check((select status = 'expired' and latitude is null from public.sos_alerts where id = :'alert5'), 'it expires, and its location goes');

-- The database refuses a location on an alert that is over
select pg_temp.fails(format('update public.sos_alerts set latitude = 1, longitude = 1 where id = %L', :'alert1'), 'a finished alert cannot hold a location');

-- Old alerts drop out of view
update public.sos_alerts set ended_at = now() - interval '2 days' where id = :'alert1';
select pg_temp.act_as(:member_b);
select pg_temp.check(pg_temp.count_of(format('select * from public.sos_alerts where id = %L', :'alert1')) = 0, 'an alert that ended days ago is no longer shown to members');
reset role;

-- The leaders' history
select pg_temp.act_as(:pastor_a);
select pg_temp.check((select count(*) = 5 from public.sos_history(:'church_a')), 'the Pastor sees the history of alerts');
select pg_temp.check((select count(*) filter (where status = 'expired') = 1 and count(*) filter (where status = 'ended_by_leader') = 1 from public.sos_history(:'church_a')), 'with how each one ended');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select * from public.sos_history(%L)', :'church_a'), 'a member cannot see the history');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select * from public.sos_history(%L)', :'church_a'), 'nor can another church''s Pastor');
reset role;

-- Alerts go with the person or the church
delete from auth.users where id = :member_b;
select pg_temp.check((select count(*) = 0 from public.sos_alerts where sender_id = :member_b), 'deleting an account removes their alerts');
