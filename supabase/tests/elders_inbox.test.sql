-- Elders inbox rules: a member writes to the elders, every leader can read and reply, and nobody
-- else (other members, other churches, people waiting for approval) sees a thing.

\set pastor_a '''aaaaaaaa-0000-0000-0007-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0007-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0007-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0007-000000000003'''
\set member_a2 '''aaaaaaaa-0000-0000-0007-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0007-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'epa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'epb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'eea@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'ema@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'ema2@example.com', '{"full_name": "Mark Member"}'),
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
select public.register_church('Elders Church A', 'Springfield', 'a@elders.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Elders Church B', 'Shelbyville', 'b@elders.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Mary writes to the elders.
select pg_temp.act_as(:member_a);
select thread_id as thread_a from public.send_to_elders(:'church_a', 'Could someone pray with my family?') \gset
select pg_temp.fails(format('select * from public.send_to_elders(%L, ''   '')', :'church_a'), 'an empty message is rejected');
select pg_temp.fails('select * from public.elder_threads', 'threads cannot be read directly');
select pg_temp.fails('select * from public.elder_messages', 'messages cannot be read directly');
select pg_temp.check((select thread_id = :'thread_a' and not unread from public.my_elder_thread(:'church_a')), 'the member sees their own thread');
select pg_temp.check((select count(*) = 1 from public.elder_thread_messages(:'thread_a')), 'and their message in it');
select * from public.send_to_elders(:'church_a', 'A second message');
select pg_temp.check((select count(distinct thread_id) = 1 from public.my_elder_thread(:'church_a')), 'writing again uses the same thread');
reset role;

-- Every leader sees it and it needs a reply.
select pg_temp.act_as(:pastor_a);
select pg_temp.check((select count(*) = 1 and bool_and(needs_reply) from public.elder_inbox(:'church_a')), 'the Pastor sees the thread, waiting for a reply');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 1 and bool_and(member_name = 'Mary Member') from public.elder_inbox(:'church_a')), 'an elder sees it too');
select pg_temp.check((select count(*) = 2 from public.elder_thread_messages(:'thread_a')), 'and can read the messages');
select public.reply_as_elder(:'thread_a', 'Of course. We are praying for you.') as reply_id \gset
select pg_temp.check((select not needs_reply from public.elder_inbox(:'church_a')), 'a reply clears "needs reply"');
select pg_temp.check((select sender_name = 'Eli Elder' and not from_member from public.elder_thread_messages(:'thread_a') limit 1), 'and carries the elder''s own name');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check((select unread from public.my_elder_thread(:'church_a')), 'the member sees there is a new reply');
select public.mark_elder_thread_read(:'thread_a');
select pg_temp.check((select not unread from public.my_elder_thread(:'church_a')), 'and opening the thread marks it read');
select pg_temp.fails(format('select public.reply_as_elder(%L, ''Replying to myself'')', :'thread_a'), 'a member cannot reply as an elder');
select pg_temp.check((select count(*) = 0 from public.elder_inbox(:'church_a')), 'a member gets nothing from the leaders'' inbox');
reset role;

-- Other members, people waiting, and other churches see nothing.
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select * from public.elder_thread_messages(%L)', :'thread_a'), 'another member cannot read the thread');
select pg_temp.fails(format('select public.reply_as_elder(%L, ''hi'')', :'thread_a'), 'or reply in it');
select pg_temp.check((select count(*) = 0 from public.my_elder_thread(:'church_a')), 'and has no thread of their own yet');
reset role;

select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('select * from public.send_to_elders(%L, ''let me in'')', :'church_a'), 'someone waiting for approval cannot write to the elders');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select * from public.elder_thread_messages(%L)', :'thread_a'), 'another church''s Pastor cannot read the thread');
select pg_temp.fails(format('select public.reply_as_elder(%L, ''hi'')', :'thread_a'), 'or reply in it');
select pg_temp.check((select count(*) = 0 from public.elder_inbox(:'church_a')), 'and sees nothing in this church''s inbox');
reset role;

set role anon;
select pg_temp.fails(format('select * from public.elder_inbox(%L)', :'church_a'), 'signed-out visitors cannot read the inbox');
reset role;
