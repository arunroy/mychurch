-- Reporting rules: members report only what they can see, reports about leaders go to the app's
-- administrators rather than other leaders, reviewers see only their own queue, and a report keeps a
-- short copy of the text so it can be judged even after the content is deleted.

\set pastor_a '''aaaaaaaa-0000-0000-0010-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0010-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0010-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0010-000000000003'''
\set member_a2 '''aaaaaaaa-0000-0000-0010-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0010-000000000005'''
\set admin_x '''cccccccc-0000-0000-0010-000000000001'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'rpa3@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'rpb3@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'rea3@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'rma3@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'rma23@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'rpe3@example.com', '{"full_name": "Pat Pending"}'),
  (:admin_x, 'rax3@example.com', '{"full_name": "Alex Admin"}');

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

-- Reports a batch of chat messages as the current user, to test the daily limit.
create function pg_temp.report_bulk(p_church uuid) returns void language plpgsql as $$
declare r record;
begin
  for r in select id from public.church_chat_messages where body like 'bulk %' order by body loop
    perform public.report_content(p_church, 'chat_message', r.id, 'spam', '');
  end loop;
end $$;

set client_min_messages = notice;

select pg_temp.act_as(:pastor_a);
select public.register_church('Report Church A', 'Springfield', 'a@report.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Report Church B', 'Shelbyville', 'b@report.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');
insert into public.platform_admins (user_id) values (:admin_x);

-- Things that could be reported.
insert into public.church_chat_messages (church_id, sender_id, body) values
  (:'church_a', :member_a, 'A rude message from Mary'),
  (:'church_a', :elder_a, 'A rude message from the elder');
select id as msg_member from public.church_chat_messages where sender_id = :member_a \gset
select id as msg_elder from public.church_chat_messages where sender_id = :elder_a \gset
insert into public.church_chat_messages (church_id, sender_id, body)
  select :'church_a', :member_a, 'bulk ' || lpad(n::text, 2, '0') from generate_series(1, 11) n;

select pg_temp.act_as(:member_a);
select public.create_prayer_request(:'church_a', 'A pastor-only prayer', 'pastor') as prayer_private \gset
reset role;

insert into public.conversations (church_id, user_a, user_b)
  values (:'church_a', least(:member_a::uuid, :member_a2::uuid), greatest(:member_a::uuid, :member_a2::uuid)) returning id as convo \gset
insert into public.messages (conversation_id, sender_id, body) values (:'convo', :member_a, 'A private insult') returning id as private_msg \gset

-- Reporting what you can see.
select pg_temp.act_as(:member_a2);
select public.report_content(:'church_a', 'chat_message', :'msg_member', 'harassment', 'This was unkind');
reset role;
select pg_temp.check((select review_by = 'leaders' and excerpt = 'A rude message from Mary' and target_user_id = :member_a and details = 'This was unkind'
  from public.content_reports where target_id = :'msg_member'), 'a member can report a chat message; it goes to the leaders with a copy of the text');

select pg_temp.act_as(:member_a2);
select public.report_content(:'church_a', 'chat_message', :'msg_member', 'harassment', 'Again');
reset role;
select pg_temp.check((select count(*) = 1 from public.content_reports where target_id = :'msg_member'), 'reporting the same thing twice does not add a second report');

select pg_temp.act_as(:member_a2);
select public.report_content(:'church_a', 'chat_message', :'msg_elder', 'inappropriate', '');
reset role;
select pg_temp.check((select review_by = 'platform' from public.content_reports where target_id = :'msg_elder'), 'a report about a leader goes to the app''s administrators');

select pg_temp.act_as(:member_a2);
select public.report_content(:'church_a', 'private_message', :'private_msg', 'harassment', '');
reset role;
select pg_temp.check((select review_by = 'leaders' and excerpt = 'A private insult' from public.content_reports where target_id = :'private_msg'),
  'a person in a private conversation can report its message, and the text is copied for the reviewers');

-- Not what you cannot see, not your own, not if you are not a member.
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.report_content(%L, ''chat_message'', %L, ''spam'', '''')', :'church_a', :'msg_member'), 'you cannot report your own content');
reset role;
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select public.report_content(%L, ''prayer_request'', %L, ''spam'', '''')', :'church_a', :'prayer_private'), 'a member cannot report a prayer request they cannot see');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.report_content(%L, ''private_message'', %L, ''spam'', '''')', :'church_a', :'private_msg'), 'a leader outside the conversation cannot report a private message');
select pg_temp.fails(format('select public.report_content(%L, ''chat_message'', %L, ''nonsense'', '''')', :'church_a', :'msg_member'), 'an unknown reason is refused');
reset role;
select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('select public.report_content(%L, ''chat_message'', %L, ''spam'', '''')', :'church_a', :'msg_member'), 'someone waiting for approval cannot report');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select public.report_content(%L, ''chat_message'', %L, ''spam'', '''')', :'church_a', :'msg_member'), 'another church cannot report here');
reset role;

-- Reporting a member.
select pg_temp.act_as(:member_a2);
select public.report_content(:'church_a', 'member', :member_a, 'harassment', 'Keeps bothering me');
reset role;
select pg_temp.check((select review_by = 'leaders' and excerpt = 'Mary Member' from public.content_reports where target_type = 'member' and target_id = :member_a),
  'a member can report another member');

-- Remember the reports' ids now, while acting as the database owner, so later steps do not read the closed table.
select id as rep_member from public.content_reports where target_id = :'msg_member' \gset
select id as rep_elder from public.content_reports where target_id = :'msg_elder' \gset

-- Each reviewer sees only their own queue.
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 3 from public.report_queue(:'church_a')), 'a leader sees the reports for the leaders (three)');
select pg_temp.check((select count(*) = 0 from public.report_queue(:'church_a') where target_id = :'msg_elder'), 'but not the report about themselves');
reset role;
select pg_temp.act_as(:member_a2);
select pg_temp.check((select count(*) = 0 from public.report_queue(:'church_a')), 'an ordinary member sees no reports');
select pg_temp.check((select count(*) = 0 from public.platform_report_queue()), 'and none of the administrators'' reports');
reset role;
select pg_temp.act_as(:admin_x);
select pg_temp.check((select count(*) = 1 and bool_and(target_id = :'msg_elder') from public.platform_report_queue()), 'an app administrator sees the report about the leader');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.check((select count(*) = 0 from public.report_queue(:'church_a')), 'another church''s Pastor sees nothing');
reset role;

-- Closing a report.
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select public.resolve_report(%L, false, null)', :'rep_member'), 'a member cannot close a report');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.resolve_report(%L, false, null)', :'rep_elder'), 'a leader cannot close a report about a leader');
select public.resolve_report(:'rep_member', false, 'Spoke to her.');
reset role;
select pg_temp.check((select status = 'resolved' and resolution_note = 'Spoke to her.' and resolved_by = :elder_a from public.content_reports where target_id = :'msg_member'),
  'a leader can close a report they review');
select pg_temp.act_as(:admin_x);
select public.resolve_report(:'rep_elder', true, null);
reset role;
select pg_temp.check((select status = 'dismissed' from public.content_reports where target_id = :'msg_elder'), 'an administrator can close a report about a leader');
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.resolve_report(%L, false, null)', :'rep_member'), 'a closed report cannot be closed again');
reset role;

-- The copy of the text outlives the content.
delete from public.church_chat_messages where id = :'msg_member';
select pg_temp.check((select excerpt = 'A rude message from Mary' from public.content_reports where target_id = :'msg_member'), 'the report keeps its copy after the message is deleted');

-- A limit on reports per day (four were already sent by this member today in this test, so one more than six is refused).
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select pg_temp.report_bulk(%L)', :'church_a'), 'too many reports in a day are refused');
reset role;

-- The table itself is closed.
select pg_temp.act_as(:member_a2);
select pg_temp.fails('select * from public.content_reports', 'reports cannot be read directly');
reset role;
set role anon;
select pg_temp.fails(format('select * from public.report_queue(%L)', :'church_a'), 'signed-out visitors cannot read reports');
reset role;
