-- Q&A rules: members ask (named or anonymous). A question is private to the Pastor (and the asker of a
-- named one) until the Pastor answers and chooses to share it with the church leaders or the whole
-- church. Anonymous questions keep nothing about the asker. One church never sees another's.

\set pastor_a '''aaaaaaaa-0000-0000-0009-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0009-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0009-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0009-000000000003'''
\set member_a2 '''aaaaaaaa-0000-0000-0009-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0009-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'qpa2@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'qpb2@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'qea2@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'qma2@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'qma22@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'qpe2@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('QA Church A', 'Springfield', 'a@qa.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('QA Church B', 'Shelbyville', 'b@qa.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Mary asks one under her name; Mark asks one anonymously.
select pg_temp.act_as(:member_a);
select public.ask_question(:'church_a', 'Why do we baptise by immersion?', false);
select pg_temp.fails('select * from public.questions', 'questions cannot be read directly');
select pg_temp.fails(format('select public.ask_question(%L, ''   '', false)', :'church_a'), 'an empty question is rejected');
reset role;
select pg_temp.act_as(:member_a2);
select public.ask_question(:'church_a', 'Is it wrong to doubt?', true);
reset role;

-- The Pastor answers questions; they do not ask them.
select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('select public.ask_question(%L, ''A question from the Pastor'', false)', :'church_a'), 'the Pastor cannot ask a question');
select pg_temp.fails(format('select public.ask_question(%L, ''An anonymous one from the Pastor'', true)', :'church_a'), 'or ask one anonymously');
reset role;
select pg_temp.check((select count(*) = 2 from public.questions), 'and nothing was added');

-- What an anonymous question keeps.
select pg_temp.check((select count(*) = 1 from public.questions where asker_id is null), 'an anonymous question has no asker stored');
select pg_temp.check((select asked_at = date_trunc('day', asked_at) from public.questions where asker_id is null), 'and its time is rounded to the day');
select pg_temp.check((select count(*) = 1 from public.questions where asker_id = :member_a), 'a named question keeps its asker');
select pg_temp.check((select count(*) = 2 from public.questions where visibility = 'pastor'), 'new questions start with the Pastor only');

-- A new question is seen by the Pastor, and by the asker if named. Nobody else.
select pg_temp.act_as(:pastor_a);
select pg_temp.check((select count(*) = 2 from public.qa_feed(:'church_a')), 'the Pastor sees both new questions');
select id as q_anon from public.qa_feed(:'church_a') where body like 'Is it wrong%' \gset
select id as q_named from public.qa_feed(:'church_a') where body like 'Why do we%' \gset
select pg_temp.check((select asker_name = 'Mary Member' from public.qa_feed(:'church_a') where id = :'q_named'), 'the named one shows its asker');
select pg_temp.check((select asker_name is null from public.qa_feed(:'church_a') where id = :'q_anon'), 'the anonymous one shows no name');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 0 from public.qa_feed(:'church_a')), 'an elder sees neither');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.check((select count(*) = 1 and bool_and(is_mine) from public.qa_feed(:'church_a')), 'Mary sees only her own question');
reset role;
select pg_temp.act_as(:member_a2);
select pg_temp.check((select count(*) = 0 from public.qa_feed(:'church_a')), 'Mark sees nothing, not even his own anonymous question');
reset role;

-- Only the Pastor answers and chooses who sees a question.
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.answer_question(%L, ''An elder answer'')', :'q_named'), 'an elder cannot answer');
select pg_temp.fails(format('select public.set_question_visibility(%L, ''church'')', :'q_named'), 'or change who sees a question');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.answer_question(%L, ''I will answer my own question'')', :'q_named'), 'a member cannot answer');
select pg_temp.fails(format('select public.set_question_visibility(%L, ''church'')', :'q_named'), 'or share a question');
reset role;

select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('select public.set_question_visibility(%L, ''church'')', :'q_named'), 'a question cannot go to the whole church before it has an answer');
select pg_temp.fails(format('select public.set_question_visibility(%L, ''everyone'')', :'q_named'), 'an unknown visibility is rejected');
select public.answer_question(:'q_named', 'Baptism by immersion pictures dying and rising with Christ.');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check((select answer like 'Baptism by%' and visibility = 'pastor' from public.qa_feed(:'church_a') where id = :'q_named'),
  'the asker of a named question sees the answer privately');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 0 from public.qa_feed(:'church_a')), 'the elder still sees nothing: an answer alone shares nothing');
reset role;

-- The Pastor shares one with the leaders only (no answer needed), then another with everyone.
select pg_temp.act_as(:pastor_a);
select public.set_question_visibility(:'q_anon', 'leaders');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 1 and bool_and(id = :'q_anon') from public.qa_feed(:'church_a')), 'an elder sees a question shared with the leaders');
reset role;
select pg_temp.act_as(:member_a2);
select pg_temp.check((select count(*) = 0 from public.qa_feed(:'church_a')), 'but members still do not');
reset role;

select pg_temp.act_as(:pastor_a);
select public.set_question_visibility(:'q_named', 'leaders');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 2 from public.qa_feed(:'church_a')), 'sharing the answered one with leaders shows it to the elder too');
reset role;

select pg_temp.act_as(:pastor_a);
select public.set_question_visibility(:'q_named', 'church');
reset role;
select pg_temp.act_as(:member_a2);
select pg_temp.check((select answer like 'Baptism by%' and visibility = 'church' and asker_name = 'Mary Member' and answered_by_name = 'Pastor Anna'
  from public.qa_feed(:'church_a') where id = :'q_named'), 'shared with the church, every member sees the question, the answer and who gave it');
select pg_temp.check((select count(*) = 1 from public.qa_feed(:'church_a')), 'and only that one: the leaders-only question stays hidden');
reset role;

select pg_temp.act_as(:pastor_a);
select public.set_question_visibility(:'q_named', 'pastor');
reset role;
select pg_temp.act_as(:member_a2);
select pg_temp.check((select count(*) = 0 from public.qa_feed(:'church_a')), 'the Pastor can make it private again');
reset role;

-- An anonymous question works the same way, but the asker only learns the answer if it goes to the church.
select pg_temp.act_as(:pastor_a);
select public.answer_question(:'q_anon', 'No. Many faithful people have doubted.');
select public.set_question_visibility(:'q_anon', 'church');
reset role;
select pg_temp.act_as(:member_a2);
select pg_temp.check((select answer like 'No. Many%' and asker_name is null and not is_mine from public.qa_feed(:'church_a') where id = :'q_anon'),
  'a shared anonymous question shows its answer and no name');
reset role;

-- The daily limit on anonymous questions is five.
select pg_temp.act_as(:member_a2);
select public.ask_question(:'church_a', 'Anonymous 2', true);
select public.ask_question(:'church_a', 'Anonymous 3', true);
select public.ask_question(:'church_a', 'Anonymous 4', true);
select public.ask_question(:'church_a', 'Anonymous 5', true);
select pg_temp.fails(format('select public.ask_question(%L, ''Anonymous 6'', true)', :'church_a'), 'a sixth anonymous question in a day is refused');
select public.ask_question(:'church_a', 'A named one is not limited', false);
reset role;

-- Removing.
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select public.delete_question(%L)', :'q_named'), 'a member cannot remove someone else''s question');
select pg_temp.fails(format('select public.delete_question(%L)', :'q_anon'), 'and cannot take back their own anonymous question');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.delete_question(%L)', :'q_anon'), 'an elder cannot remove a question');
reset role;
select pg_temp.act_as(:member_a);
select public.delete_question(:'q_named');
reset role;
select pg_temp.check((select count(*) = 0 from public.questions where id = :'q_named'), 'the asker can remove their own named question');
select pg_temp.act_as(:pastor_a);
select public.delete_question(:'q_anon');
reset role;
select pg_temp.check((select count(*) = 0 from public.questions where id = :'q_anon'), 'the Pastor can remove an anonymous question');

-- Outsiders.
select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('select public.ask_question(%L, ''let me in'', false)', :'church_a'), 'someone waiting for approval cannot ask');
select pg_temp.check((select count(*) = 0 from public.qa_feed(:'church_a')), 'and sees no questions');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.check((select count(*) = 0 from public.qa_feed(:'church_a')), 'another church''s Pastor sees none of these questions');
select pg_temp.fails(format('select public.answer_question(%L, ''hi'')', :'q_anon'), 'and cannot answer here');
reset role;

set role anon;
select pg_temp.fails(format('select * from public.qa_feed(%L)', :'church_a'), 'signed-out visitors cannot read questions');
reset role;
