-- Messaging rules: any two members of a church can chat, only those two can read
-- it, and nobody outside the church or the conversation can see or send anything.

\set pastor_a '''aaaaaaaa-0000-0000-0003-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0003-000000000001'''
\set mary '''aaaaaaaa-0000-0000-0003-000000000002'''
\set mike '''aaaaaaaa-0000-0000-0003-000000000003'''
\set hidden '''aaaaaaaa-0000-0000-0003-000000000004'''
\set elder_a '''aaaaaaaa-0000-0000-0003-000000000005'''
\set admin_a '''aaaaaaaa-0000-0000-0003-000000000006'''
\set pending_a '''aaaaaaaa-0000-0000-0003-000000000007'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'mpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'mpb@example.com', '{"full_name": "Pastor Ben"}'),
  (:mary, 'mm@example.com', '{"full_name": "Mary Member"}'),
  (:mike, 'mk@example.com', '{"full_name": "Mike Member"}'),
  (:hidden, 'mh@example.com', '{"full_name": "Hana Hidden"}'),
  (:elder_a, 'me@example.com', '{"full_name": "Eli Elder"}'),
  (:admin_a, 'ma@example.com', '{"full_name": "Ada Admin"}'),
  (:pending_a, 'mp@example.com', '{"full_name": "Pat Pending"}');

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
insert into public.memberships (church_id, user_id, role, status, directory_visible) values
  (:'church_a', :mary, 'member', 'approved', true),
  (:'church_a', :mike, 'member', 'approved', true),
  (:'church_a', :hidden, 'member', 'approved', false),
  (:'church_a', :elder_a, 'elder', 'approved', true),
  (:'church_a', :admin_a, 'admin', 'approved', true),
  (:'church_a', :pending_a, 'member', 'pending', true);

-- Who can be reached.
select pg_temp.act_as(:mary);
select pg_temp.check(public.can_message(:'church_a', :pastor_a), 'a member can message the Pastor');
select pg_temp.check(public.can_message(:'church_a', :mike), 'a member can message another member');
select pg_temp.check(public.can_message(:'church_a', :elder_a), 'a member can message an elder');
select pg_temp.check(not public.can_message(:'church_a', :hidden), 'a member cannot message someone hidden from the directory');
select pg_temp.check(not public.can_message(:'church_a', :mary), 'nobody can message themselves');
select pg_temp.check(not public.can_message(:'church_a', :pending_a), 'someone still waiting for approval cannot be messaged');
select pg_temp.check(not public.can_message(:'church_a', :pastor_b), 'a member cannot message someone from another church');
select pg_temp.check(pg_temp.count_of(format('select * from public.messageable_members(%L)', :'church_a')) = 4,
  'the picker lists the Pastor, elder, admin and the other visible member, but not the hidden one');
select pg_temp.fails(format('select public.start_conversation(%L, %L)', :'church_a', :hidden),
  'starting a chat with someone hidden fails');
reset role;

select pg_temp.act_as(:hidden);
select pg_temp.check(public.can_message(:'church_a', :pastor_a), 'a hidden member can still message the Pastor');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.check(public.can_message(:'church_a', :hidden), 'a leader can message a hidden member');
select pg_temp.check(pg_temp.count_of(format('select * from public.messageable_members(%L)', :'church_a')) = 5,
  'a leader''s picker lists every approved member, including hidden ones');
reset role;

-- With the directory switched off, members can still reach leaders, and only leaders.
update public.churches set directory_enabled = false where id = :'church_a';
select pg_temp.act_as(:mary);
select pg_temp.check(not public.can_message(:'church_a', :mike), 'with the directory off, members cannot start chats with each other');
select pg_temp.check(pg_temp.count_of(format('select * from public.messageable_members(%L)', :'church_a')) = 3,
  'with the directory off, the picker lists only leaders');
reset role;
update public.churches set directory_enabled = true where id = :'church_a';

-- A chat is one conversation per pair, whichever side starts it.
select pg_temp.act_as(:mary);
select public.start_conversation(:'church_a', :pastor_a) as conv_mp \gset
select pg_temp.check(public.start_conversation(:'church_a', :pastor_a) = :'conv_mp', 'starting the same chat twice finds the same conversation');
select pg_temp.check(pg_temp.count_of('select * from public.my_conversations(''' || :'church_a' || ''')') = 0,
  'a chat nobody has written in yet stays out of the inbox');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.check(public.start_conversation(:'church_a', :mary) = :'conv_mp', 'the other person starting it finds the same conversation');
reset role;

-- Sending and reading.
select pg_temp.act_as(:mary);
insert into public.messages (conversation_id, sender_id, body) values (:'conv_mp', auth.uid(), 'Hello Pastor');
select pg_temp.check(true, 'a member can send a message');
select pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, body) values (%L, %L, ''I am the Pastor'')', :'conv_mp', :pastor_a),
  'nobody can send a message in someone else''s name');
select pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), '' '')', :'conv_mp'),
  'an empty message is refused');
select pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), %L)', :'conv_mp', repeat('x', 2001)),
  'a message over 2000 characters is refused');
select pg_temp.check(pg_temp.count_of('select * from public.my_conversations(''' || :'church_a' || ''')') = 1,
  'the conversation shows up once a message is sent');
select pg_temp.check((select not unread from public.my_conversations(:'church_a')), 'your own message is not unread for you');
reset role;

select pg_temp.act_as(:pastor_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.messages where conversation_id = %L', :'conv_mp')) = 1,
  'the other person can read it');
select pg_temp.check((select unread and other_name = 'Mary Member' and last_message_preview = 'Hello Pastor'
  from public.my_conversations(:'church_a')), 'the other person sees it unread, with the sender''s name and a preview');
select public.mark_conversation_read(:'conv_mp');
select pg_temp.check((select not unread from public.my_conversations(:'church_a')), 'marking it read clears the unread flag');
insert into public.messages (conversation_id, sender_id, body) values (:'conv_mp', auth.uid(), 'Hi Mary');
reset role;

select pg_temp.act_as(:mary);
select pg_temp.check((select unread from public.my_conversations(:'church_a')), 'a reply shows as unread to the first person');
select pg_temp.check(pg_temp.count_of(format('select * from public.messages where conversation_id = %L', :'conv_mp')) = 2,
  'both messages are in the conversation');
reset role;

-- Nobody else can read it or write in it: other members, leaders, admins, other churches.
select pg_temp.act_as(:mike);
select pg_temp.check(pg_temp.count_of('select * from public.messages') = 0, 'another member cannot read the conversation');
select pg_temp.check(pg_temp.count_of('select * from public.conversations') = 0, 'another member cannot see that it exists');
select pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), ''butting in'')', :'conv_mp'),
  'another member cannot write into it');
reset role;

select pg_temp.act_as(:elder_a);
select pg_temp.check(pg_temp.count_of('select * from public.messages') = 0, 'an elder cannot read other people''s messages');
reset role;
select pg_temp.act_as(:admin_a);
select pg_temp.check(pg_temp.count_of('select * from public.messages') = 0, 'a church admin cannot read other people''s messages');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.messages') = 0, 'another church''s Pastor cannot read them');
select pg_temp.check(pg_temp.count_of('select * from public.conversations') = 0, 'another church''s Pastor cannot see the conversation');
select pg_temp.fails(format('select public.start_conversation(%L, %L)', :'church_a', :mary),
  'someone outside the church cannot start a chat with a member');
reset role;

-- Messages are permanent: no edits and no deletes from the app.
select pg_temp.act_as(:mary);
select pg_temp.fails(format('update public.messages set body = ''rewritten'' where conversation_id = %L', :'conv_mp'),
  'messages cannot be edited');
select pg_temp.fails(format('delete from public.messages where conversation_id = %L', :'conv_mp'),
  'messages cannot be deleted');
reset role;
select pg_temp.check((select count(*) = 2 and bool_and(body <> 'rewritten') from public.messages where conversation_id = :'conv_mp'),
  'both messages are still there, unchanged');

-- Conversations are read-only from the app: the inbox row is kept by the database.
select pg_temp.act_as(:mary);
select pg_temp.fails(format('update public.conversations set last_message_preview = ''forged'' where id = %L', :'conv_mp'),
  'the inbox row cannot be edited directly');
select pg_temp.fails(format('insert into public.conversations (church_id, user_a, user_b) values (%L, %L, %L)', :'church_a', :mary, :mike),
  'conversations cannot be created directly');
reset role;

-- A member and a leader chatting about someone hidden from the directory.
select pg_temp.act_as(:pastor_a);
select public.start_conversation(:'church_a', :hidden) as conv_hp \gset
insert into public.messages (conversation_id, sender_id, body) values (:'conv_hp', auth.uid(), 'Checking in');
reset role;
select pg_temp.act_as(:hidden);
select pg_temp.check(pg_temp.count_of('select * from public.my_conversations(''' || :'church_a' || ''')') = 1,
  'the hidden member sees the leader''s message');
insert into public.messages (conversation_id, sender_id, body) values (:'conv_hp', auth.uid(), 'Thanks!');
select pg_temp.check(true, 'and can reply');
reset role;

-- Leaving the church ends access and stops new messages.
delete from public.memberships where church_id = :'church_a' and user_id = :mary;
select pg_temp.act_as(:mary);
select pg_temp.check(pg_temp.count_of('select * from public.messages') = 0, 'someone removed from the church can no longer read their messages');
select pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), ''still here?'')', :'conv_mp'),
  'and cannot send more');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), ''are you there?'')', :'conv_mp'),
  'nobody can write to someone who has left the church');
reset role;

set role anon;
select pg_temp.fails('select * from public.messages', 'signed-out visitors cannot read messages');
select pg_temp.fails('select public.messageable_members(''' || :'church_a' || ''')', 'signed-out visitors cannot list members');
reset role;
