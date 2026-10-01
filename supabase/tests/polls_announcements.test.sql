-- Announcements: leaders post, members read what is still showing, nobody crosses churches.
-- Polls: any member asks, votes are private and counted once, results stay hidden until you vote.

\set pastor_a '''aaaaaaaa-0000-0000-0003-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0003-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0003-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0003-000000000003'''
\set member_a2 '''aaaaaaaa-0000-0000-0003-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0003-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'ppa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'ppb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'pea@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'pma@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'pma2@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'ppe@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Poll Church A', 'Springfield', 'a@poll.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Poll Church B', 'Shelbyville', 'b@poll.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------

-- Announcements are posted by the post-announcement function (service role, which is the owner
-- here), after it has checked the caller leads the church. Nobody inserts directly.
insert into public.announcements (church_id, author_id, title, body, expires_at)
values (:'church_a', :elder_a, 'Service at 10am', 'Doors open at 9:30.', now() + interval '3 days');
insert into public.announcements (church_id, author_id, title, expires_at)
values (:'church_a', :elder_a, 'Old news', now() - interval '1 day');

select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('insert into public.announcements (church_id, author_id, title) values (%L, %L, ''posted directly'')', :'church_a', :elder_a),
  'even a leader cannot insert an announcement directly');
select pg_temp.check(pg_temp.count_of('select * from public.announcements') = 2, 'a leader sees every announcement, expired too');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.announcements') = 1, 'a member sees only the announcements still showing');
select pg_temp.check((select title = 'Service at 10am' from public.announcements), 'and it is the current one');
select pg_temp.fails(format('insert into public.announcements (church_id, author_id, title) values (%L, %L, ''Free pizza'')', :'church_a', :member_a),
  'a member cannot post an announcement');
delete from public.announcements where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 2 from public.announcements), 'a member cannot remove announcements');

select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of('select * from public.announcements') = 0, 'someone waiting for approval sees none');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.announcements') = 0, 'another church''s Pastor sees none');
select pg_temp.fails(format('insert into public.announcements (church_id, author_id, title) values (%L, %L, ''hi'')', :'church_a', :pastor_b),
  'and cannot post here');
delete from public.announcements where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 2 from public.announcements), 'and cannot remove any here');

select pg_temp.act_as(:pastor_a);
delete from public.announcements where title = 'Old news';
reset role;
select pg_temp.check((select count(*) = 1 from public.announcements), 'a leader can remove an announcement');

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------

select pg_temp.act_as(:member_a);
select public.create_poll(:'church_a', 'Picnic day?', array['Saturday', 'Sunday', '  ', 'Skip it'], false, now() + interval '2 days') as poll1 \gset
select pg_temp.check(public.create_poll(:'church_a', 'Bring food?', array['Yes', 'No'], true, null) is not null,
  'any member can start a poll');
select pg_temp.fails(format('select public.create_poll(%L, ''One choice'', array[''Only''])', :'church_a'),
  'a poll needs at least two choices');
select pg_temp.fails(format('select public.create_poll(%L, ''Same'', array[''Yes'', ''yes''])', :'church_a'),
  'choices must differ');
select pg_temp.fails(format('select public.create_poll(%L, ''Late'', array[''A'', ''B''], false, now() - interval ''1 hour'')', :'church_a'),
  'a poll cannot close in the past');
select pg_temp.fails('select * from public.polls', 'polls cannot be read directly');
select pg_temp.fails('select * from public.poll_votes', 'votes cannot be read directly');
select pg_temp.fails('insert into public.poll_votes (option_id, poll_id, user_id) select id, poll_id, auth.uid() from public.poll_options limit 1',
  'votes cannot be written directly');

-- Before voting, totals are hidden.
select pg_temp.check((select bool_and(total_voters is null) from public.church_polls(:'church_a')), 'totals are hidden until you vote');
select pg_temp.check((select jsonb_array_length(options) = 3 from public.church_polls(:'church_a') where id = :'poll1'),
  'blank choices are dropped');
select o ->> 'id' as saturday from public.church_polls(:'church_a') p, jsonb_array_elements(p.options) o
  where p.id = :'poll1' and o ->> 'label' = 'Saturday' \gset
select o ->> 'id' as sunday from public.church_polls(:'church_a') p, jsonb_array_elements(p.options) o
  where p.id = :'poll1' and o ->> 'label' = 'Sunday' \gset
reset role;

select pg_temp.act_as(:member_a2);
select public.cast_vote(:'poll1', array[:'saturday']::uuid[]);
select pg_temp.check((select total_voters = 1 and my_option_ids = array[:'saturday']::uuid[] from public.church_polls(:'church_a') where id = :'poll1'),
  'a member can vote and then sees the total');
select pg_temp.fails(format('select public.cast_vote(%L, array[%L, %L]::uuid[])', :'poll1', :'saturday', :'sunday'),
  'a single-choice poll takes one answer');
select public.cast_vote(:'poll1', array[:'sunday']::uuid[]);
select pg_temp.check((select total_voters = 1 and my_option_ids = array[:'sunday']::uuid[] from public.church_polls(:'church_a') where id = :'poll1'),
  'changing a vote replaces the old one');
reset role;

select pg_temp.act_as(:elder_a);
select public.cast_vote(:'poll1', array[:'sunday']::uuid[]);
select pg_temp.check((select total_voters = 2 from public.church_polls(:'church_a') where id = :'poll1'), 'votes are counted per person');
select pg_temp.check((select (o ->> 'votes')::int = 2 from public.church_polls(:'church_a') p, jsonb_array_elements(p.options) o
  where p.id = :'poll1' and o ->> 'label' = 'Sunday'), 'and added up per choice');
select pg_temp.fails(format('select public.cast_vote(%L, array[gen_random_uuid()])', :'poll1'), 'you cannot vote for something that is not a choice');
reset role;

-- Outsiders cannot see or vote.
select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.church_polls(%L)', :'church_a')) = 0, 'someone waiting for approval sees no polls');
select pg_temp.fails(format('select public.cast_vote(%L, array[%L]::uuid[])', :'poll1', :'saturday'), 'and cannot vote');
select pg_temp.fails(format('select public.create_poll(%L, ''Hi'', array[''A'', ''B''])', :'church_a'), 'and cannot start a poll');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of(format('select * from public.church_polls(%L)', :'church_a')) = 0, 'another church sees no polls here');
select pg_temp.fails(format('select public.cast_vote(%L, array[%L]::uuid[])', :'poll1', :'saturday'), 'and cannot vote here');
select pg_temp.fails(format('select public.close_poll(%L)', :'poll1'), 'and cannot close a poll here');
select pg_temp.fails(format('select public.delete_poll(%L)', :'poll1'), 'and cannot remove one here');
reset role;

-- Closing: only the creator or a leader; then voting stops and everyone sees the results.
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select public.close_poll(%L)', :'poll1'), 'a member cannot close someone else''s poll');
select pg_temp.fails(format('select public.delete_poll(%L)', :'poll1'), 'or remove it');
reset role;

select pg_temp.act_as(:member_a);
select public.close_poll(:'poll1');
reset role;

select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select public.cast_vote(%L, array[%L]::uuid[])', :'poll1', :'saturday'), 'nobody can vote once it has closed');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check((select is_closed and total_voters = 2 from public.church_polls(:'church_a') where id = :'poll1'), 'a closed poll shows its results');
reset role;

-- A leader can remove any poll; the creator can remove their own.
select pg_temp.act_as(:elder_a);
select public.delete_poll(:'poll1');
reset role;
select pg_temp.check((select count(*) = 1 from public.polls), 'a leader can remove a poll');
select pg_temp.check((select count(*) = 0 from public.poll_votes), 'and its votes go with it');

set role anon;
select pg_temp.fails('select * from public.announcements', 'signed-out visitors cannot read announcements');
select pg_temp.fails(format('select * from public.church_polls(%L)', :'church_a'), 'or polls');
reset role;
