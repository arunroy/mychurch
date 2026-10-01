-- Church chat rules: every approved member reads and posts, nobody else does, and only
-- the author or a leader can remove a message.

\set pastor_a '''aaaaaaaa-0000-0000-0002-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0002-000000000001'''
\set member_a '''aaaaaaaa-0000-0000-0002-000000000002'''
\set member_a2 '''aaaaaaaa-0000-0000-0002-000000000003'''
\set pending_a '''aaaaaaaa-0000-0000-0002-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'cpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'cpb@example.com', '{"full_name": "Pastor Ben"}'),
  (:member_a, 'cma@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'cma2@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'cpe@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Chat Church A', 'Springfield', 'a@chat.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Chat Church B', 'Shelbyville', 'b@chat.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Anyone approved can post, in their own name.
select pg_temp.act_as(:member_a);
insert into public.church_chat_messages (church_id, sender_id, body) values (:'church_a', :member_a, 'Hello everyone');
select pg_temp.fails(format('insert into public.church_chat_messages (church_id, sender_id, body) values (%L, %L, ''pretending'')', :'church_a', :member_a2),
  'a message cannot be posted in someone else''s name');
select pg_temp.fails(format('insert into public.church_chat_messages (church_id, sender_id, body) values (%L, %L, ''   '')', :'church_a', :member_a),
  'an empty message is rejected');
reset role;

select pg_temp.act_as(:member_a2);
insert into public.church_chat_messages (church_id, sender_id, body) values (:'church_a', :member_a2, 'Good morning');
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages') = 2, 'a member reads everyone''s messages');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_chat_feed(%L)', :'church_a')) = 2,
  'the feed returns both messages');
select pg_temp.check((select bool_and(sender_name <> '') from public.church_chat_feed(:'church_a')),
  'the feed names each sender');

-- A member cannot remove or change what someone else wrote.
delete from public.church_chat_messages where sender_id = :member_a;
select pg_temp.fails('update public.church_chat_messages set body = ''edited''', 'messages cannot be edited');
reset role;
select pg_temp.check((select count(*) = 2 from public.church_chat_messages), 'a member cannot remove another member''s message');

-- Authors remove their own; leaders remove anyone's.
select pg_temp.act_as(:member_a2);
delete from public.church_chat_messages where sender_id = :member_a2;
reset role;
select pg_temp.check((select count(*) = 1 from public.church_chat_messages), 'an author can remove their own message');

select pg_temp.act_as(:pastor_a);
delete from public.church_chat_messages where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 0 from public.church_chat_messages), 'the Pastor can remove any message');

-- Pending people and other churches are shut out.
insert into public.church_chat_messages (church_id, sender_id, body) values (:'church_a', :member_a, 'Still here');

-- The unread count covers other people's messages, and clears once the chat is read.
select pg_temp.act_as(:pastor_a);
select pg_temp.check(public.church_chat_unread_count(:'church_a') = 1, 'the Pastor has one unread message');
select public.mark_church_chat_read(:'church_a');
select pg_temp.check(public.church_chat_unread_count(:'church_a') = 0, 'reading the chat clears the unread count');
select pg_temp.fails('select * from public.church_chat_reads', 'read markers are not readable directly');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.check(public.church_chat_unread_count(:'church_a') = 0, 'your own messages are never unread');
reset role;
select pg_temp.act_as(:pending_a);
select pg_temp.check(public.church_chat_unread_count(:'church_a') = 0, 'someone waiting for approval has none');
reset role;

select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages') = 0, 'someone waiting for approval reads nothing');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_chat_feed(%L)', :'church_a')) = 0, 'and gets nothing from the feed');
select pg_temp.fails(format('insert into public.church_chat_messages (church_id, sender_id, body) values (%L, %L, ''let me in'')', :'church_a', :pending_a),
  'and cannot post');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages') = 0, 'another church''s Pastor reads nothing');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_chat_feed(%L)', :'church_a')) = 0, 'and gets nothing from the feed');
select pg_temp.fails(format('insert into public.church_chat_messages (church_id, sender_id, body) values (%L, %L, ''hi'')', :'church_a', :pastor_b),
  'and cannot post here');
delete from public.church_chat_messages where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 1 from public.church_chat_messages), 'and cannot remove anything here');

set role anon;
select pg_temp.fails('select * from public.church_chat_messages', 'signed-out visitors cannot read the chat');
reset role;
