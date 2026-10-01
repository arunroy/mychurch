-- RSVP rules: members answer for events in their own church, everyone sees totals, and only the
-- event's creator and leaders see who answered what.

\set pastor_a '''aaaaaaaa-0000-0000-0006-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0006-000000000001'''
\set member_a '''aaaaaaaa-0000-0000-0006-000000000002'''
\set member_a2 '''aaaaaaaa-0000-0000-0006-000000000003'''
\set pending_a '''aaaaaaaa-0000-0000-0006-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'rpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'rpb@example.com', '{"full_name": "Pastor Ben"}'),
  (:member_a, 'rma@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'rma2@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'rpe@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('RSVP Church A', 'Springfield', 'a@rsvp.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('RSVP Church B', 'Shelbyville', 'b@rsvp.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Mary adds an event; others answer.
insert into public.events (church_id, created_by, title, starts_at)
values (:'church_a', :member_a, 'Youth night', now() + interval '3 days') returning id as event_id \gset

select pg_temp.act_as(:member_a2);
select public.set_rsvp(:'event_id', 'going');
select pg_temp.check((select going = 1 and my_status = 'going' from public.event_rsvp_summary(:'event_id')), 'a member can say they are going');
select public.set_rsvp(:'event_id', 'maybe');
select pg_temp.check((select going = 0 and maybe = 1 and my_status = 'maybe' from public.event_rsvp_summary(:'event_id')), 'and change their mind');
select pg_temp.fails(format('select public.set_rsvp(%L, ''definitely'')', :'event_id'), 'an unknown answer is rejected');
select pg_temp.check((select people is null from public.event_rsvp_summary(:'event_id')), 'an ordinary member does not see who answered');
select pg_temp.fails('select * from public.event_rsvps', 'RSVPs cannot be read directly');
reset role;

select pg_temp.act_as(:pastor_a);
select public.set_rsvp(:'event_id', 'going');
select pg_temp.check((select going = 1 and maybe = 1 and jsonb_array_length(people) = 2 from public.event_rsvp_summary(:'event_id')),
  'a leader sees the totals and who answered');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check((select jsonb_array_length(people) = 2 from public.event_rsvp_summary(:'event_id')), 'the event''s creator sees who answered');
reset role;

select pg_temp.act_as(:member_a2);
select public.set_rsvp(:'event_id', null);
select pg_temp.check((select maybe = 0 and my_status is null from public.event_rsvp_summary(:'event_id')), 'a member can take their answer back');
reset role;

-- Outsiders.
select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('select public.set_rsvp(%L, ''going'')', :'event_id'), 'someone waiting for approval cannot answer');
select pg_temp.fails(format('select * from public.event_rsvp_summary(%L)', :'event_id'), 'and cannot see the totals');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select public.set_rsvp(%L, ''going'')', :'event_id'), 'another church cannot answer');
select pg_temp.fails(format('select * from public.event_rsvp_summary(%L)', :'event_id'), 'or see the totals');
reset role;

set role anon;
select pg_temp.fails(format('select * from public.event_rsvp_summary(%L)', :'event_id'), 'signed-out visitors cannot see RSVPs');
reset role;
