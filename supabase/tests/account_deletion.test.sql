-- Account deletion: deleting a sign-in user must succeed (nothing may block it), remove what belongs to them,
-- and leave the church's own things and other people's content alone. The delete-account function adds the
-- file cleanup and the last-Pastor check on top of this; here we test what the database does by itself.

\set pastor_a '''aaaaaaaa-0000-0000-0011-000000000001'''
\set pastor_a2 '''aaaaaaaa-0000-0000-0011-000000000002'''
\set leaver '''aaaaaaaa-0000-0000-0011-000000000003'''
\set friend '''aaaaaaaa-0000-0000-0011-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'dpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_a2, 'dpa2@example.com', '{"full_name": "Pastor Andrew"}'),
  (:leaver, 'dle@example.com', '{"full_name": "Lee Leaver"}'),
  (:friend, 'dfr@example.com', '{"full_name": "Fran Friend"}');

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

set client_min_messages = notice;

select pg_temp.act_as(:pastor_a);
select public.register_church('Deletion Church', 'Springfield', 'a@deletion.example') as church_a \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :leaver, 'member', 'approved'),
  (:'church_a', :friend, 'member', 'approved');

-- Everything the leaver might have made.
select pg_temp.act_as(:leaver);
select public.send_to_elders(:'church_a', 'A note to the elders');
select public.create_prayer_request(:'church_a', 'Please pray for me', 'church');
select public.create_poll(:'church_a', 'Picnic?', array['Yes', 'No'], false, null);
select public.ask_question(:'church_a', 'A named question', false);
select public.ask_question(:'church_a', 'An anonymous question', true);
select public.send_anonymous_message(:'church_a', 'An anonymous message', false);
select public.submit_sermon(:'church_a', 'member', 'My article', '', '', null, null, null, null, 'Words I wrote.', null);
reset role;
insert into public.church_chat_messages (church_id, sender_id, body) values (:'church_a', :leaver, 'Hello chat');
insert into public.events (church_id, created_by, title, starts_at) values (:'church_a', :leaver, 'Leaver''s event', now() + interval '2 days');
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[leaver]', :leaver, 'ios');
insert into public.conversations (church_id, user_a, user_b)
  values (:'church_a', least(:leaver::uuid, :friend::uuid), greatest(:leaver::uuid, :friend::uuid)) returning id as convo \gset
insert into public.messages (conversation_id, sender_id, body) values (:'convo', :friend, 'Friend wrote this to the leaver');
insert into public.content_reports (church_id, reporter_id, target_type, target_id, target_user_id, reason, excerpt, review_by)
  values (:'church_a', :friend, 'chat_message', gen_random_uuid(), :leaver, 'spam', 'Hello chat', 'leaders');

-- The function removes these two before deleting the user, because the database only clears their author.
delete from public.sermons where created_by = :leaver and source <> 'pastor';
delete from public.content_reports where target_user_id = :leaver;

-- Delete the account.
delete from auth.users where id = :leaver;

select pg_temp.check((select count(*) = 0 from public.profiles where id = :leaver), 'the profile is gone');
select pg_temp.check((select count(*) = 0 from public.memberships where user_id = :leaver), 'and their memberships');
select pg_temp.check((select count(*) = 0 from public.church_chat_messages where body = 'Hello chat'), 'and their chat messages');
select pg_temp.check((select count(*) = 0 from public.prayer_requests where body = 'Please pray for me'), 'and their prayer requests');
select pg_temp.check((select count(*) = 0 from public.polls where question = 'Picnic?'), 'and their polls');
select pg_temp.check((select count(*) = 0 from public.questions where body = 'A named question'), 'and their named questions');
select pg_temp.check((select count(*) = 0 from public.elder_threads where member_id = :leaver), 'and their thread with the elders');
select pg_temp.check((select count(*) = 0 from public.push_tokens where user_id = :leaver), 'and their notification tokens');
select pg_temp.check((select count(*) = 0 from public.sermons where title = 'My article'), 'and the articles they submitted');
select pg_temp.check((select count(*) = 0 from public.content_reports where target_user_id = :leaver), 'and reports about what they wrote');

-- The other person's side of a private conversation goes too; this is what the delete screen warns about.
select pg_temp.check((select count(*) = 0 from public.conversations where id = :'convo'), 'a private conversation is deleted for both people');
select pg_temp.check((select count(*) = 0 from public.messages where conversation_id = :'convo'), 'with its messages');

-- What stays, without their name.
select pg_temp.check((select count(*) = 1 and bool_and(created_by is null) from public.events where title = 'Leaver''s event'), 'an event they added stays, with no author');
select pg_temp.check((select count(*) = 1 from public.questions where body = 'An anonymous question'), 'an anonymous question stays: nothing linked it to them');
select pg_temp.check((select count(*) = 1 from public.anonymous_messages where body = 'An anonymous message'), 'and so does an anonymous message');
select pg_temp.check((select count(*) = 0 from public.anonymity_limits where user_id = :leaver), 'but their daily counter is removed');

-- Other people are untouched.
select pg_temp.check((select count(*) = 1 from public.profiles where id = :friend), 'the friend''s account is untouched');
select pg_temp.check((select count(*) = 2 from public.memberships where church_id = :'church_a' and user_id in (:pastor_a, :friend)), 'and so are the other memberships');
