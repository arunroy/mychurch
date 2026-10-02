-- Sunday worship plans: the Pastor, elders and worship leaders plan; every member reads.

\set pastor_a '''aaaaaaaa-0000-0000-0012-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0012-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0012-000000000002'''
\set leader_a '''aaaaaaaa-0000-0000-0012-000000000003'''
\set member_a '''aaaaaaaa-0000-0000-0012-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0012-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'wpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'wpb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'wpe@example.com', '{"full_name": "Eli Elder"}'),
  (:leader_a, 'wpl@example.com', '{"full_name": "Lena Leader"}'),
  (:member_a, 'wpm@example.com', '{"full_name": "Mary Member"}'),
  (:pending_a, 'wpp@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Worship Church A', 'Springfield', 'a@wp.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Worship Church B', 'Shelbyville', 'b@wp.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :leader_a, 'member', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- A Sunday, and a day that is not one
select (date_trunc('week', current_date)::date + 6) as sun \gset
select (date_trunc('week', current_date)::date + 7) as mon \gset

-- The Worship leader switch
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.set_worship_leader(%L, %L, true)', :'church_a', :member_a), 'a member cannot make themselves a worship leader');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.set_worship_leader(%L, %L, true)', :'church_a', :leader_a), 'an elder cannot choose worship leaders');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select public.set_worship_leader(%L, %L, true)', :'church_a', :leader_a), 'another church''s Pastor cannot either');
reset role;
select pg_temp.act_as(:pastor_a);
select public.set_worship_leader(:'church_a', :leader_a, true);
select pg_temp.fails(format('select public.set_worship_leader(%L, %L, true)', :'church_a', :pending_a), 'it needs an approved member');
reset role;
select pg_temp.check((select is_worship_leader from public.memberships where user_id = :leader_a), 'the Pastor makes a member a worship leader');
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('update public.memberships set is_worship_leader = true where user_id = %L', :member_a), 'the switch cannot be set directly');
reset role;
select pg_temp.check(not (select is_worship_leader from public.memberships where user_id = :member_a), 'and it stayed off');

-- Who can plan
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, 23, 1, 6, '''', ''[]'')', :'church_a', :'sun'), 'a member cannot plan worship');
reset role;
select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, null, null, null, '''', ''[]'')', :'church_a', :'sun'), 'nor can someone waiting for approval');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, null, null, null, '''', ''[]'')', :'church_a', :'sun'), 'nor another church''s Pastor');
reset role;

select pg_temp.act_as(:leader_a);
select public.save_worship_plan(:'church_a', :'sun', 23, 1, 6, 'Come ready to sing', '[{"title":"How Great Thou Art","artist":"Stuart Hine","link":"https://www.youtube.com/watch?v=abc"},{"title":"Amazing Grace"}]') as plan1 \gset
reset role;
select pg_temp.check((select psalm_reference = 'Psalm 23:1-6' and note = 'Come ready to sing' from public.worship_plans where id = :'plan1'), 'a worship leader plans a Sunday, with the Psalm named for them');
select pg_temp.check((select count(*) = 2 and min(position) = 1 and max(position) = 2 from public.worship_songs where plan_id = :'plan1'), 'with its songs in order');

select pg_temp.act_as(:elder_a);
select public.save_worship_plan(:'church_a', :'sun', 100, 1, 1, '', '[{"title":"Only one song"}]');
reset role;
select pg_temp.check((select count(*) = 1 from public.worship_plans where church_id = :'church_a' and service_date = :'sun'), 'an elder saving the same Sunday replaces the plan instead of adding another');
select pg_temp.check((select psalm_reference = 'Psalm 100:1' from public.worship_plans where id = :'plan1'), 'a single verse reads as one verse');
select pg_temp.check((select count(*) = 1 and bool_and(title = 'Only one song') from public.worship_songs where plan_id = :'plan1'), 'and the old songs are gone');

-- Checks on what is saved
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, null, null, null, '''', ''[]'')', :'church_a', :'mon'), 'worship is planned for a Sunday');
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, 151, 1, 1, '''', ''[]'')', :'church_a', :'sun'), 'there is no Psalm 151');
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, 23, 6, 1, '''', ''[]'')', :'church_a', :'sun'), 'the verses must be in order');
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, null, null, null, '''', ''[{"title":"X","link":"javascript:alert(1)"}]'')', :'church_a', :'sun'), 'a link must be a web link');
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, null, null, null, '''', ''[{"title":" "}]'')', :'church_a', :'sun'), 'a song needs a title');
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, null, null, null, '''', %L::jsonb)', :'church_a', :'sun', (select jsonb_agg(jsonb_build_object('title', 'Song ' || n)) from generate_series(1, 13) n)), 'up to 12 songs');
select public.save_worship_plan(:'church_a', :'sun', null, null, null, '', '[]');
reset role;
select pg_temp.check((select psalm_chapter is null and psalm_reference = '' from public.worship_plans where id = :'plan1'), 'a plan can have no Psalm');
select pg_temp.check((select count(*) = 1 from public.worship_plans where church_id = :'church_a'), 'and a failed save changes nothing');

-- Reading
select pg_temp.act_as(:elder_a);
select public.save_worship_plan(:'church_a', :'sun', 23, 1, 6, '', '[{"title":"Be Thou My Vision"}]');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.worship_plans') = 1 and pg_temp.count_of('select * from public.worship_songs') = 1, 'every member reads the plan and its songs');
select pg_temp.fails(format('insert into public.worship_songs (plan_id, church_id, position, title) values (%L, %L, 9, ''Sneaky'')', :'plan1', :'church_a'), 'but cannot write a song');
delete from public.worship_plans where id = :'plan1';
reset role;
select pg_temp.check((select count(*) = 1 from public.worship_plans where id = :'plan1'), 'or delete a plan');

select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of('select * from public.worship_plans') = 0, 'someone waiting for approval sees nothing');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.worship_plans') = 0, 'another church sees nothing');
reset role;
set role anon;
select pg_temp.fails('select * from public.worship_plans', 'signed-out visitors cannot read plans');
reset role;

-- Deleting
select pg_temp.act_as(:leader_a);
delete from public.worship_plans where id = :'plan1';
reset role;
select pg_temp.check((select count(*) = 0 from public.worship_plans where id = :'plan1'), 'a worship leader can delete a plan');
select pg_temp.check((select count(*) = 0 from public.worship_songs where plan_id = :'plan1'), 'and its songs go with it');

-- Taking the switch away
select pg_temp.act_as(:pastor_a);
select public.set_worship_leader(:'church_a', :leader_a, false);
reset role;
select pg_temp.act_as(:leader_a);
select pg_temp.fails(format('select public.save_worship_plan(%L, %L, null, null, null, '''', ''[]'')', :'church_a', :'sun'), 'a former worship leader can no longer plan');
reset role;
