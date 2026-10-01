-- Birthdays and anniversaries: members add their own birthday, leaders add and delete the rest,
-- everyone in the church sees the combined list, nobody crosses churches.

\set pastor_a '''aaaaaaaa-0000-0000-0004-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0004-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0004-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0004-000000000003'''
\set hidden_a '''aaaaaaaa-0000-0000-0004-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0004-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'sda@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'sdb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'sde@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'sdm@example.com', '{"full_name": "Mary Member"}'),
  (:hidden_a, 'sdh@example.com', '{"full_name": "Hugh Hidden"}'),
  (:pending_a, 'sdp@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Day Church A', 'Springfield', 'a@day.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Day Church B', 'Shelbyville', 'b@day.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status, directory_visible) values
  (:'church_a', :elder_a, 'elder', 'approved', true),
  (:'church_a', :member_a, 'member', 'approved', true),
  (:'church_a', :hidden_a, 'member', 'approved', false),
  (:'church_a', :pending_a, 'member', 'pending', true);

-- A member's own birthday
select pg_temp.act_as(:member_a);
update public.profiles set birth_month = 3, birth_day = 14 where id = :member_a;
select pg_temp.check((select birth_month = 3 and birth_day = 14 from public.profiles where id = :member_a), 'a member can set their own birthday');
select pg_temp.fails(format('update public.profiles set birth_month = 2, birth_day = 30 where id = %L', :member_a), '30 February is not a day');
select pg_temp.fails(format('update public.profiles set birth_month = 4, birth_day = 31 where id = %L', :member_a), '31 April is not a day');
select pg_temp.fails(format('update public.profiles set birth_month = 5, birth_day = null where id = %L', :member_a), 'a birthday needs both month and day');
update public.profiles set birth_month = 2, birth_day = 29 where id = :member_a;
update public.profiles set birth_month = 3, birth_day = 14 where id = :member_a;
reset role;

update public.profiles set birth_month = 7, birth_day = 1 where id in (:hidden_a, :pending_a);

-- Leaders add dates
select pg_temp.act_as(:elder_a);
insert into public.special_days (church_id, kind, name, month, day, created_by)
  values (:'church_a', 'birthday', 'Grandma Ruth', 8, 20, :elder_a);
insert into public.special_days (church_id, kind, name, month, day, year, created_by)
  values (:'church_a', 'anniversary', 'John and Ruth Mensah', 6, 5, 1999, :elder_a);
select pg_temp.fails(format('insert into public.special_days (church_id, kind, name, month, day, year, created_by) values (%L, ''birthday'', ''X'', 1, 1, 1980, %L)', :'church_a', :elder_a),
  'a birthday does not keep a year');
select pg_temp.fails(format('insert into public.special_days (church_id, kind, name, month, day, created_by) values (%L, ''birthday'', ''X'', 2, 30, %L)', :'church_a', :elder_a),
  'an added date must exist on the calendar');
select pg_temp.fails(format('insert into public.special_days (church_id, kind, name, month, day, created_by) values (%L, ''birthday'', ''X'', 1, 1, %L)', :'church_a', :pastor_a),
  'a leader cannot add one in someone else''s name');
reset role;

-- Everyone in the church sees the combined list
select pg_temp.act_as(:member_a);
select pg_temp.check((select count(*) = 3 from public.church_special_days(:'church_a')), 'a member sees added dates and member birthdays');
select pg_temp.check(not exists (select 1 from public.church_special_days(:'church_a') where user_id in (:hidden_a, :pending_a)),
  'someone hidden from the directory, or still waiting, is left out');
select pg_temp.check(pg_temp.count_of('select * from public.special_days') = 2, 'a member can read the added dates');
select pg_temp.fails(format('insert into public.special_days (church_id, kind, name, month, day, created_by) values (%L, ''birthday'', ''X'', 1, 1, %L)', :'church_a', :member_a),
  'a member cannot add a date for others');
delete from public.special_days;
reset role;
select pg_temp.check((select count(*) = 2 from public.special_days), 'a member cannot delete added dates');

select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.church_special_days(%L)', :'church_a')) = 0, 'someone waiting for approval sees nothing');
select pg_temp.check(pg_temp.count_of('select * from public.special_days') = 0, 'and cannot read the table');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of(format('select * from public.church_special_days(%L)', :'church_a')) = 0, 'another church''s Pastor sees nothing');
select pg_temp.fails(format('insert into public.special_days (church_id, kind, name, month, day, created_by) values (%L, ''birthday'', ''X'', 1, 1, %L)', :'church_a', :pastor_b),
  'and cannot add here');
delete from public.special_days;
reset role;
select pg_temp.check((select count(*) = 2 from public.special_days), 'and cannot delete here');

select pg_temp.act_as(:elder_a);
delete from public.special_days where name = 'Grandma Ruth';
reset role;
select pg_temp.check((select count(*) = 1 from public.special_days), 'a leader can delete an added date');

set role anon;
select pg_temp.fails('select * from public.special_days', 'signed-out visitors cannot read the table');
select pg_temp.fails(format('select * from public.church_special_days(%L)', :'church_a'), 'or the list');
reset role;
