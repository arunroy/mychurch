-- Anonymous messages to the Pastor: nothing in the table identifies the sender, only the Pastor reads
-- them, sending is limited per day, and a reply is found only with the code the sender was given.

\set pastor_a '''aaaaaaaa-0000-0000-0008-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0008-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0008-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0008-000000000003'''
\set member_a2 '''aaaaaaaa-0000-0000-0008-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0008-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'apa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'apb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'aea@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'ama@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'ama2@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'ape@example.com', '{"full_name": "Pat Pending"}');

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

set client_min_messages = notice;

select pg_temp.act_as(:pastor_a);
select public.register_church('Anon Church A', 'Springfield', 'a@anon.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Anon Church B', 'Shelbyville', 'b@anon.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Nothing in the table can name the sender, and it keeps a date, not a time.
select pg_temp.check((select count(*) = 0 from information_schema.columns
  where table_schema = 'public' and table_name = 'anonymous_messages'
    and column_name in ('user_id', 'author_id', 'sender_id', 'created_by', 'created_at', 'updated_at')),
  'the message table has no column that could identify a sender or a time');
select pg_temp.check((select data_type = 'date' from information_schema.columns
  where table_schema = 'public' and table_name = 'anonymous_messages' and column_name = 'sent_on'), 'it records the day only');
select pg_temp.check((select count(*) = 0 from information_schema.columns
  where table_schema = 'public' and table_name = 'anonymity_limits' and column_name in ('message_id', 'church_id')),
  'the daily counter cannot be tied to a message or a church');

-- Mary sends one without a reply and one asking for a reply.
select pg_temp.act_as(:member_a);
select pg_temp.check(public.send_anonymous_message(:'church_a', 'I am struggling and not sure who to tell.', false) is null,
  'no code is given when no reply was asked for');
select public.send_anonymous_message(:'church_a', 'Could you speak about forgiveness?', true) as reply_code \gset
select pg_temp.check(:'reply_code' ~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$', 'a reply code is given when one was asked for');
select pg_temp.fails('select * from public.anonymous_messages', 'messages cannot be read directly');
select pg_temp.fails('select * from public.anonymity_limits', 'the counter cannot be read directly');
select pg_temp.fails(format('select public.send_anonymous_message(%L, ''   '', false)', :'church_a'), 'an empty message is rejected');
reset role;
select pg_temp.check((select count(*) = 2 from public.anonymous_messages), 'both messages were stored');
select pg_temp.check((select count(*) = 1 from public.anonymous_messages where code_hash is not null and code_hash <> :'reply_code'),
  'only a hash of the code is stored, not the code');

-- The daily limit is three.
select pg_temp.act_as(:member_a);
select public.send_anonymous_message(:'church_a', 'Third one today.', false);
select pg_temp.fails(format('select public.send_anonymous_message(%L, ''Fourth one.'', false)', :'church_a'), 'a fourth message in a day is refused');
reset role;

-- Only the Pastor reads them.
select pg_temp.act_as(:pastor_a);
select pg_temp.check((select count(*) = 3 from public.anonymous_inbox(:'church_a')), 'the Pastor sees all three');
select pg_temp.check((select count(*) = 1 from public.anonymous_inbox(:'church_a') where can_reply), 'and which one can be answered');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 0 from public.anonymous_inbox(:'church_a')), 'an elder sees none of them');
reset role;
select pg_temp.act_as(:member_a2);
select pg_temp.check((select count(*) = 0 from public.anonymous_inbox(:'church_a')), 'another member sees none of them');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.check((select count(*) = 0 from public.anonymous_inbox(:'church_a')), 'another church''s Pastor sees none of them');
reset role;

-- Replying: only to a message with a code, only by the Pastor, and found only with the code.
select pg_temp.act_as(:pastor_a);
select id as answerable from public.anonymous_inbox(:'church_a') where can_reply \gset
select id as unanswerable from public.anonymous_inbox(:'church_a') where not can_reply limit 1 \gset
select pg_temp.fails(format('select public.reply_to_anonymous(%L, ''No way to send this'')', :'unanswerable'), 'the Pastor cannot reply where no code was made');
select public.reply_to_anonymous(:'answerable', 'Yes, we will talk about forgiveness on Sunday.');
select public.mark_anonymous_read(:'unanswerable');
reset role;

select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.reply_to_anonymous(%L, ''Elder reply'')', :'answerable'), 'an elder cannot reply');
reset role;

select pg_temp.act_as(:member_a2);
select pg_temp.check((select found and reply like 'Yes, we will%' from public.check_anonymous_reply(:'reply_code')), 'anyone holding the code sees the reply');
select pg_temp.check((select found and reply like 'Yes, we will%' from public.check_anonymous_reply(lower(replace(:'reply_code', '-', '')))),
  'and the code works without dashes or capitals');
select pg_temp.check((select not found and reply is null from public.check_anonymous_reply('0000-0000-0000-0000')), 'a wrong code finds nothing');
reset role;

select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('select public.send_anonymous_message(%L, ''let me in'', false)', :'church_a'), 'someone waiting for approval cannot send');
reset role;

-- The Pastor can remove a message.
select pg_temp.act_as(:pastor_a);
select public.delete_anonymous_message(:'unanswerable');
reset role;
select pg_temp.check((select count(*) = 2 from public.anonymous_messages), 'the Pastor can delete a message');

set role anon;
select pg_temp.fails(format('select * from public.anonymous_inbox(%L)', :'church_a'), 'signed-out visitors cannot read the inbox');
reset role;
