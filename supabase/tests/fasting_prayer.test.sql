-- Fasting prayer: half-hour slots on the church's fasting Friday, visible to every member.

\set pastor_a '''aaaaaaaa-0000-0000-0015-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0015-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0015-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0015-000000000003'''
\set member_b '''aaaaaaaa-0000-0000-0015-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0015-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'fpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'fpb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'fpe@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'fpm@example.com', '{"full_name": "Mary Member"}'),
  (:member_b, 'fpm2@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'fpp@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Fasting Church A', 'Springfield', 'a@fp.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Fasting Church B', 'Shelbyville', 'b@fp.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_b, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- January 2030: Fridays fall on the 4th, 11th, 18th and 25th, so the 18th is the third.
\set third '''2030-01-18'''
\set second '''2030-01-11'''

-- Which slots exist, with the defaults
select pg_temp.act_as(:member_a);
select pg_temp.check(public.fasting_slot_ok(:'church_a', :'third', '06:00'), 'the day starts at 6 AM');
select pg_temp.check(public.fasting_slot_ok(:'church_a', :'third', '23:30'), 'and the last slot starts at 11:30 PM');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', :'third', '05:30'), 'nothing before 6 AM');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', :'third', '06:15'), 'slots start on the half hour');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', :'third', '10:30'), 'the morning meeting is not a slot');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', :'third', '11:00'), 'nor its second half hour');
select pg_temp.check(public.fasting_slot_ok(:'church_a', :'third', '10:00') and public.fasting_slot_ok(:'church_a', :'third', '11:30'), 'the slots either side of it are');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', :'third', '19:30') and not public.fasting_slot_ok(:'church_a', :'third', '21:00'), 'the evening meeting is not a slot');
select pg_temp.check(public.fasting_slot_ok(:'church_a', :'third', '21:30'), 'prayer starts again at 9:30 PM');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', :'second', '06:00'), 'only on the third Friday');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', '2030-01-17', '06:00'), 'and only on a Friday');
select pg_temp.check((select count(*) = 30 from generate_series(0, 47) n where public.fasting_slot_ok(:'church_a', :'third', (n * interval '30 minutes')::time)), 'there are 30 slots in the day');
reset role;

-- Taking slots
select pg_temp.act_as(:member_a);
insert into public.fasting_signups (church_id, day, slot_start) values (:'church_a', :'third', '06:00'), (:'church_a', :'third', '06:30'), (:'church_a', :'third', '22:00');
select pg_temp.fails(format('insert into public.fasting_signups (church_id, day, slot_start) values (%L, %L, ''06:00'')', :'church_a', :'third'), 'the same person cannot take the same slot twice');
select pg_temp.fails(format('insert into public.fasting_signups (church_id, day, slot_start) values (%L, %L, ''10:30'')', :'church_a', :'third'), 'a meeting time cannot be taken');
select pg_temp.fails(format('insert into public.fasting_signups (church_id, day, slot_start) values (%L, %L, ''06:00'')', :'church_a', :'second'), 'another Friday cannot be taken');
select pg_temp.fails(format('insert into public.fasting_signups (church_id, day, slot_start) values (%L, ''2020-01-17'', ''06:00'')', :'church_a'), 'a fasting day that has passed cannot be taken');
select pg_temp.fails(format('insert into public.fasting_signups (church_id, day, slot_start, user_id) values (%L, %L, ''07:00'', %L)', :'church_a', :'third', :member_b), 'nobody can sign someone else up');
reset role;
select pg_temp.act_as(:member_b);
insert into public.fasting_signups (church_id, day, slot_start) values (:'church_a', :'third', '06:00');
reset role;
select pg_temp.check((select count(*) = 2 from public.fasting_signups where slot_start = '06:00'), 'several people can pray in the same slot');

select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('insert into public.fasting_signups (church_id, day, slot_start) values (%L, %L, ''08:00'')', :'church_a', :'third'), 'someone waiting for approval cannot take a slot');
select pg_temp.check(pg_temp.count_of(format('select * from public.fasting_timetable(%L, %L)', :'church_a', :'third')) = 0, 'or see the timetable');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('insert into public.fasting_signups (church_id, day, slot_start) values (%L, %L, ''08:00'')', :'church_a', :'third'), 'another church cannot take a slot');
select pg_temp.check(pg_temp.count_of('select * from public.fasting_signups') = 0, 'or see who is praying');
reset role;

-- Everyone in the church sees the timetable with names
select pg_temp.act_as(:member_b);
select pg_temp.check((select count(*) = 4 and bool_and(full_name in ('Mary Member', 'Mark Member')) from public.fasting_timetable(:'church_a', :'third')), 'every member sees who is praying when');
select pg_temp.check((select array_agg(full_name order by full_name) = array['Mark Member', 'Mary Member'] from public.fasting_timetable(:'church_a', :'third') where slot_start = '06:00'), 'with both names in a shared slot');
reset role;

-- Leaving slots
select pg_temp.act_as(:member_b);
delete from public.fasting_signups where user_id = :member_a;
reset role;
select pg_temp.check((select count(*) = 3 from public.fasting_signups where user_id = :member_a), 'a member cannot remove someone else');
select pg_temp.act_as(:member_a);
delete from public.fasting_signups where user_id = :member_a and slot_start = '22:00';
reset role;
select pg_temp.check((select count(*) = 2 from public.fasting_signups where user_id = :member_a), 'but can leave their own slot');
select pg_temp.act_as(:elder_a);
delete from public.fasting_signups where user_id = :member_b;
reset role;
select pg_temp.check((select count(*) = 0 from public.fasting_signups where user_id = :member_b), 'a leader can remove anyone');

-- The settings, managed by the Pastor and elders
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('insert into public.fasting_settings (church_id, nth_friday) values (%L, 2)', :'church_a'), 'a member cannot change the settings');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('insert into public.fasting_settings (church_id, nth_friday) values (%L, 2)', :'church_a'), 'nor can another church''s Pastor');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('insert into public.fasting_settings (church_id, nth_friday) values (%L, 5)', :'church_a'), 'there is no fifth Friday rule');
select pg_temp.fails(format('insert into public.fasting_settings (church_id, start_time) values (%L, ''06:15'')', :'church_a'), 'the day starts on the half hour');
select pg_temp.fails(format('insert into public.fasting_settings (church_id, breaks) values (%L, ''[{"start": "12:00", "end": "11:00"}]'')', :'church_a'), 'a break ends after it starts');
reset role;
-- An elder sets the day up; the Pastor could equally have.
select pg_temp.act_as(:elder_a);
insert into public.fasting_settings (church_id, nth_friday, start_time, end_time, breaks)
  values (:'church_a', 2, '05:00', '22:00', '[{"start": "12:00", "end": "13:00"}]');
select pg_temp.check(public.fasting_slot_ok(:'church_a', :'second', '05:00') and public.fasting_slot_ok(:'church_a', :'second', '10:30'), 'an elder moves it to the second Friday and opens the morning meeting time');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', :'second', '12:30') and not public.fasting_slot_ok(:'church_a', :'second', '22:00'), 'with the new break and an earlier end');
select pg_temp.check(not public.fasting_slot_ok(:'church_a', :'third', '06:00'), 'and the third Friday is no longer a fasting day');
reset role;
select pg_temp.check(public.fasting_slot_ok(:'church_b', :'third', '06:00'), 'another church keeps its own settings');
select pg_temp.act_as(:pastor_a);
update public.fasting_settings set nth_friday = 3 where church_id = :'church_a';
reset role;
select pg_temp.check((select nth_friday = 3 from public.fasting_settings where church_id = :'church_a'), 'the Pastor can change what an elder set');
select pg_temp.act_as(:pastor_a);
update public.fasting_settings set nth_friday = 2 where church_id = :'church_a';
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check((select nth_friday = 2 from public.fasting_settings where church_id = :'church_a'), 'members can read the settings');
update public.fasting_settings set nth_friday = 4 where church_id = :'church_a';
reset role;
select pg_temp.check((select nth_friday = 2 from public.fasting_settings where church_id = :'church_a'), 'but not change them');

-- The switch exists
select pg_temp.check('fasting' = any (public.known_church_features()), 'the Pastor can switch fasting prayer on');
