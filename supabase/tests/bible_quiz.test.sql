-- Bible quiz: leaders write questions, members read the ones that are due, nobody crosses churches.

\set pastor_a '''aaaaaaaa-0000-0000-0005-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0005-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0005-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0005-000000000003'''
\set pending_a '''aaaaaaaa-0000-0000-0005-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'qpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'qpb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'qea@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'qma@example.com', '{"full_name": "Mary Member"}'),
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
select public.register_church('Quiz Church A', 'Springfield', 'a@quiz.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Quiz Church B', 'Shelbyville', 'b@quiz.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- A Monday in the past and one well in the future.
select (date_trunc('week', now()) - interval '14 days')::date as past_monday,
       (date_trunc('week', now()) + interval '28 days')::date as future_monday \gset

-- Leaders write
select pg_temp.act_as(:elder_a);
insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level)
  values (:'church_a', :elder_a, 'Who built the ark?', array['Noah', 'Moses', 'David'], 0, 'little');
insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level, week_of, explanation, reference)
  values (:'church_a', :elder_a, 'How many disciples did Jesus choose?', array['7', '12', '40', '70'], 1, 'kids', :'past_monday', 'Jesus chose twelve.', 'Mark 3:14');
insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level, week_of)
  values (:'church_a', :elder_a, 'Planned for later', array['A', 'B'], 0, 'youth', :'future_monday');
select pg_temp.check(pg_temp.count_of('select * from public.quiz_questions') = 3, 'a leader sees every question, planned weeks too');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level) values (%L, %L, ''X'', array[''A'', ''B''], 0, ''kids'')', :'church_a', :pastor_a),
  'a leader cannot add one in someone else''s name');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level) values (%L, %L, ''X'', array[''Only''], 0, ''kids'')', :'church_a', :elder_a),
  'a question needs at least two choices');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level) values (%L, %L, ''X'', array[''A'', ''B'', ''C'', ''D'', ''E''], 0, ''kids'')', :'church_a', :elder_a),
  'and no more than four');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level) values (%L, %L, ''X'', array[''A'', ''  ''], 0, ''kids'')', :'church_a', :elder_a),
  'choices cannot be blank');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level) values (%L, %L, ''X'', array[''A'', ''B''], 2, ''kids'')', :'church_a', :elder_a),
  'the right answer must be one of the choices');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level) values (%L, %L, ''X'', array[''A'', ''B''], 0, ''adults'')', :'church_a', :elder_a),
  'the level must be one we offer');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level, week_of) values (%L, %L, ''X'', array[''A'', ''B''], 0, ''kids'', %L)', :'church_a', :elder_a, (:'past_monday'::date + 1)),
  'a planned week must start on a Monday');
reset role;

-- Members read what is due
select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.quiz_questions') = 2, 'a member sees the general pool and weeks that have started');
select pg_temp.check(not exists (select 1 from public.quiz_questions where question = 'Planned for later'), 'but not a week still ahead');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level) values (%L, %L, ''X'', array[''A'', ''B''], 0, ''kids'')', :'church_a', :member_a),
  'a member cannot write questions');
delete from public.quiz_questions;
reset role;
select pg_temp.check((select count(*) = 3 from public.quiz_questions), 'a member cannot delete questions');

select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of('select * from public.quiz_questions') = 0, 'someone waiting for approval sees none');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.quiz_questions') = 0, 'another church''s Pastor sees none');
select pg_temp.fails(format('insert into public.quiz_questions (church_id, created_by, question, options, correct_index, level) values (%L, %L, ''X'', array[''A'', ''B''], 0, ''kids'')', :'church_a', :pastor_b),
  'and cannot write here');
delete from public.quiz_questions;
reset role;
select pg_temp.check((select count(*) = 3 from public.quiz_questions), 'and cannot delete here');

select pg_temp.act_as(:pastor_a);
delete from public.quiz_questions where question = 'Planned for later';
reset role;
select pg_temp.check((select count(*) = 2 from public.quiz_questions), 'a leader can delete a question');

set role anon;
select pg_temp.fails('select * from public.quiz_questions', 'signed-out visitors cannot read questions');
reset role;
