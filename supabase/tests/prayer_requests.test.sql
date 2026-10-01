-- Prayer request rules: members share, the author picks who sees it, "I prayed" is counted once
-- per person, and nobody sees a request they weren't meant to.

\set pastor_a '''aaaaaaaa-0000-0000-0004-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0004-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0004-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0004-000000000003'''
\set member_a2 '''aaaaaaaa-0000-0000-0004-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0004-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'qpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'qpb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'qea@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'qma@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'qma2@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'qpe@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Prayer Church A', 'Springfield', 'a@prayer.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Prayer Church B', 'Shelbyville', 'b@prayer.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Mary shares one with the church and one with leaders; Mark shares one with the Pastor alone.
select pg_temp.act_as(:member_a);
select public.create_prayer_request(:'church_a', 'Healing for my mother', 'church') as open_req \gset
select public.create_prayer_request(:'church_a', 'A hard decision at work', 'leaders') as leaders_req \gset
select pg_temp.fails(format('select public.create_prayer_request(%L, ''   '', ''church'')', :'church_a'), 'an empty request is rejected');
select pg_temp.fails(format('select public.create_prayer_request(%L, ''x'', ''everyone'')', :'church_a'), 'an unknown visibility is rejected');
select pg_temp.fails('select * from public.prayer_requests', 'requests cannot be read directly');
select pg_temp.fails('select * from public.prayer_prayers', 'prayers cannot be read directly');
reset role;

select pg_temp.act_as(:member_a2);
select public.create_prayer_request(:'church_a', 'Something only the Pastor should know', 'pastor') as pastor_req \gset

-- Who sees what.
select pg_temp.check(pg_temp.count_of(format('select * from public.prayer_feed(%L)', :'church_a')) = 2,
  'a member sees the church request and their own, not the leaders-only one');
select pg_temp.check((select bool_and(visibility <> 'leaders') from public.prayer_feed(:'church_a')), 'the leaders-only request stays hidden from members');
reset role;

select pg_temp.act_as(:elder_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.prayer_feed(%L)', :'church_a')) = 2,
  'an elder sees church and leaders requests, not the Pastor-only one');
select pg_temp.check((select bool_and(visibility <> 'pastor') from public.prayer_feed(:'church_a')), 'the Pastor-only request stays hidden from elders');
reset role;

select pg_temp.act_as(:pastor_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.prayer_feed(%L)', :'church_a')) = 3, 'the Pastor sees all three');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.prayer_feed(%L)', :'church_a')) = 2,
  'authors see their own requests, whatever the visibility');
reset role;

-- "I prayed" counts each person once and can be taken back.
select pg_temp.act_as(:member_a2);
select pg_temp.check(public.toggle_prayed(:'open_req') = true, 'a member can say they prayed');
select pg_temp.check((select prayer_count = 1 and i_prayed from public.prayer_feed(:'church_a') where id = :'open_req'), 'and the count shows it');
select pg_temp.fails(format('select public.toggle_prayed(%L)', :'leaders_req'), 'you cannot pray for a request you cannot see');
reset role;

select pg_temp.act_as(:pastor_a);
select public.toggle_prayed(:'open_req');
select pg_temp.check((select prayer_count = 2 from public.prayer_feed(:'church_a') where id = :'open_req'), 'each person counts once');
reset role;

select pg_temp.act_as(:member_a2);
select pg_temp.check(public.toggle_prayed(:'open_req') = false, 'tapping again takes it back');
select pg_temp.check((select prayer_count = 1 and not i_prayed from public.prayer_feed(:'church_a') where id = :'open_req'), 'and lowers the count');
reset role;

-- Answering is for the author only.
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select public.set_prayer_answered(%L, true)', :'open_req'), 'only the author can mark a request answered');
reset role;
select pg_temp.act_as(:member_a);
select public.set_prayer_answered(:'open_req', true);
select pg_temp.check((select answered and answered_at is not null from public.prayer_feed(:'church_a') where id = :'open_req'), 'the author can mark it answered');
select pg_temp.check((select id = :'leaders_req' from public.prayer_feed(:'church_a') limit 1),
  'answered requests are listed after open ones');
select public.set_prayer_answered(:'open_req', false);
select pg_temp.check((select not answered and answered_at is null from public.prayer_feed(:'church_a') where id = :'open_req'), 'and reopen it');
reset role;

-- Outsiders see and do nothing.
select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.prayer_feed(%L)', :'church_a')) = 0, 'someone waiting for approval sees no requests');
select pg_temp.fails(format('select public.create_prayer_request(%L, ''let me in'', ''church'')', :'church_a'), 'and cannot share one');
select pg_temp.fails(format('select public.toggle_prayed(%L)', :'open_req'), 'or pray');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of(format('select * from public.prayer_feed(%L)', :'church_a')) = 0, 'another church sees no requests here');
select pg_temp.fails(format('select public.delete_prayer_request(%L)', :'open_req'), 'and cannot remove one');
reset role;

-- Removing: the author, or a leader who can see it.
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select public.delete_prayer_request(%L)', :'open_req'), 'a member cannot remove someone else''s request');
reset role;

select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.delete_prayer_request(%L)', :'pastor_req'), 'an elder cannot remove a request they cannot see');
select public.delete_prayer_request(:'leaders_req');
reset role;
select pg_temp.check((select count(*) = 2 from public.prayer_requests), 'an elder can remove a request they can see');

select pg_temp.act_as(:member_a);
select public.delete_prayer_request(:'open_req');
reset role;
select pg_temp.check((select count(*) = 1 from public.prayer_requests), 'an author can remove their own request');
select pg_temp.check((select count(*) = 0 from public.prayer_prayers), 'and its prayers go with it');

select pg_temp.act_as(:pastor_a);
select public.delete_prayer_request(:'pastor_req');
reset role;
select pg_temp.check((select count(*) = 0 from public.prayer_requests), 'the Pastor can remove any request');

set role anon;
select pg_temp.fails(format('select * from public.prayer_feed(%L)', :'church_a'), 'signed-out visitors cannot read prayer requests');
reset role;
