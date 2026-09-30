-- Calendar rules: any member adds events, only the creator or a leader changes
-- or removes them, and one church never sees another's calendar.

\set pastor_a '''aaaaaaaa-0000-0000-0002-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0002-000000000001'''
\set member_a '''aaaaaaaa-0000-0000-0002-000000000002'''
\set member_a2 '''aaaaaaaa-0000-0000-0002-000000000003'''
\set elder_a '''aaaaaaaa-0000-0000-0002-000000000004'''
\set admin_a '''aaaaaaaa-0000-0000-0002-000000000005'''
\set pending_a '''aaaaaaaa-0000-0000-0002-000000000006'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'epa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'epb@example.com', '{"full_name": "Pastor Ben"}'),
  (:member_a, 'ema@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'ema2@example.com', '{"full_name": "Mike Member"}'),
  (:elder_a, 'eea@example.com', '{"full_name": "Eli Elder"}'),
  (:admin_a, 'eaa@example.com', '{"full_name": "Ada Admin"}'),
  (:pending_a, 'epe@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Event Church A', 'Springfield', 'a@event.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Event Church B', 'Shelbyville', 'b@event.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :admin_a, 'admin', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Any approved member adds an event, in their own name.
select pg_temp.act_as(:member_a);
insert into public.events (church_id, title, starts_at, created_by)
values (:'church_a', 'Youth night', now() + interval '2 days', auth.uid())
returning id as event_mary \gset
select pg_temp.check(true, 'an ordinary member can add an event');
select pg_temp.fails(format('insert into public.events (church_id, title, starts_at, created_by) values (%L, ''Fake'', now(), %L)', :'church_a', :member_a2),
  'an event cannot be added in someone else''s name');
select pg_temp.fails(format('insert into public.events (church_id, title, starts_at, ends_at, created_by) values (%L, ''Backwards'', now(), now() - interval ''1 hour'', auth.uid())', :'church_a'),
  'an event cannot end before it starts');
select pg_temp.fails(format('insert into public.events (church_id, title, starts_at, created_by) values (%L, '' '', now(), auth.uid())', :'church_a'),
  'an event needs a title');
reset role;

select pg_temp.act_as(:member_a2);
insert into public.events (church_id, title, starts_at, created_by)
values (:'church_a', 'Potluck', now() + interval '3 days', auth.uid())
returning id as event_mike \gset
reset role;

-- The calendar is common to the whole church.
select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.events') = 2, 'members see everyone''s events');

-- A member cannot change or remove someone else's event.
update public.events set title = 'Hijacked' where id = :'event_mike';
delete from public.events where id = :'event_mike';
reset role;
select pg_temp.check((select title = 'Potluck' from public.events where id = :'event_mike'),
  'a member cannot edit an event someone else added');

select pg_temp.act_as(:member_a2);
delete from public.events where id = :'event_mary';
reset role;
select pg_temp.check((select count(*) = 1 from public.events where id = :'event_mary'),
  'a member cannot delete an event someone else added');

-- But can change and remove their own, and cannot move it to another church or take over authorship.
select pg_temp.act_as(:member_a);
update public.events set title = 'Youth night (moved)' where id = :'event_mary';
select pg_temp.check((select title = 'Youth night (moved)' from public.events where id = :'event_mary'),
  'the creator can edit their own event');
select pg_temp.fails(format('update public.events set church_id = %L where id = %L', :'church_b', :'event_mary'),
  'an event cannot be moved to another church');
select pg_temp.fails(format('update public.events set created_by = %L where id = %L', :member_a2, :'event_mary'),
  'authorship cannot be changed');
reset role;

-- Leaders manage everyone's events.
select pg_temp.act_as(:elder_a);
update public.events set title = 'Potluck (elder note)' where id = :'event_mike';
select pg_temp.check((select title = 'Potluck (elder note)' from public.events where id = :'event_mike'),
  'an elder can edit any event');
delete from public.events where id = :'event_mary';
select pg_temp.check(pg_temp.count_of(format('select * from public.events where id = %L', :'event_mary')) = 0,
  'an elder can delete an event they did not create');
reset role;

insert into public.events (church_id, title, starts_at, created_by)
values (:'church_a', 'Choir', now() + interval '4 days', :member_a) returning id as event_choir \gset
select pg_temp.act_as(:pastor_a);
delete from public.events where id = :'event_choir';
select pg_temp.check(pg_temp.count_of(format('select * from public.events where id = %L', :'event_choir')) = 0,
  'the Pastor can delete any event');
reset role;

insert into public.events (church_id, title, starts_at, created_by)
values (:'church_a', 'Bake sale', now() + interval '5 days', :member_a) returning id as event_bake \gset
select pg_temp.act_as(:admin_a);
delete from public.events where id = :'event_bake';
select pg_temp.check(pg_temp.count_of(format('select * from public.events where id = %L', :'event_bake')) = 0,
  'a church admin can delete any event');
reset role;

-- Someone waiting for approval, and other churches, see and touch nothing.
select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of('select * from public.events') = 0, 'someone still waiting for approval sees no events');
select pg_temp.fails(format('insert into public.events (church_id, title, starts_at, created_by) values (%L, ''Sneaky'', now(), auth.uid())', :'church_a'),
  'someone still waiting for approval cannot add events');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.events') = 0, 'another church''s Pastor sees none of this calendar');
select pg_temp.fails(format('insert into public.events (church_id, title, starts_at, created_by) values (%L, ''Intruder'', now(), auth.uid())', :'church_a'),
  'another church''s Pastor cannot add an event here');
delete from public.events where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 1 from public.events where id = :'event_mike'),
  'another church''s Pastor cannot delete events here');

-- Deleting a church's creator keeps the event, now looked after by leaders.
delete from auth.users where id = :member_a2;
select pg_temp.check((select created_by is null from public.events where id = :'event_mike'),
  'an event outlives its creator''s account');
select pg_temp.act_as(:elder_a);
delete from public.events where id = :'event_mike';
select pg_temp.check(pg_temp.count_of('select * from public.events') = 0, 'leaders can remove an event whose creator has left');
reset role;

set role anon;
select pg_temp.fails('select * from public.events', 'signed-out visitors cannot read events');
reset role;
