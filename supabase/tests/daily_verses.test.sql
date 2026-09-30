-- Daily verse rules: only the Pastor writes, members read what is due, and
-- one church never sees another's verses.

\set pastor_a '''aaaaaaaa-0000-0000-0001-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0001-000000000001'''
\set member_a '''aaaaaaaa-0000-0000-0001-000000000002'''
\set elder_a '''aaaaaaaa-0000-0000-0001-000000000003'''
\set pending_a '''aaaaaaaa-0000-0000-0001-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'vpa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'vpb@example.com', '{"full_name": "Pastor Ben"}'),
  (:member_a, 'vma@example.com', '{"full_name": "Mary Member"}'),
  (:elder_a, 'vea@example.com', '{"full_name": "Eli Elder"}'),
  (:pending_a, 'vpe@example.com', '{"full_name": "Pat Pending"}');

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

-- Two churches, verified, with a member, an elder and a pending request in A.
select pg_temp.act_as(:pastor_a);
select public.register_church('Verse Church A', 'Springfield', 'a@verse.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Verse Church B', 'Shelbyville', 'b@verse.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- The Pastor writes today's verse and one for next week.
select pg_temp.act_as(:pastor_a);
insert into public.daily_verses (church_id, verse_date, reference, verse_text, translation, reflection, created_by)
values (:'church_a', current_date, 'John 3:16', 'For God so loved the world...', 'World English Bible', 'Take heart.', auth.uid());
insert into public.daily_verses (church_id, verse_date, reference, verse_text, created_by)
values (:'church_a', current_date + 7, 'Psalm 23:1', 'The LORD is my shepherd.', auth.uid());
select pg_temp.check(pg_temp.count_of('select * from public.daily_verses') = 2,
  'the Pastor sees today''s verse and the scheduled one');
select pg_temp.fails(format('insert into public.daily_verses (church_id, verse_date, reference, verse_text, created_by) values (%L, current_date, ''Psalm 1:1'', ''x'', auth.uid())', :'church_a'),
  'a church has one verse per day');
update public.daily_verses set reflection = 'Updated.' where church_id = :'church_a' and verse_date = current_date;
select pg_temp.check((select reflection = 'Updated.' from public.daily_verses where verse_date = current_date),
  'the Pastor can edit a verse');
select pg_temp.fails(format('insert into public.daily_verses (church_id, verse_date, reference, verse_text, created_by) values (%L, current_date + 1, ''Psalm 1:1'', ''x'', %L)', :'church_a', :member_a),
  'a verse cannot be written in someone else''s name');
reset role;

-- Members read what is due, never what is scheduled for later.
select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.daily_verses') = 1,
  'a member sees today''s verse but not next week''s');
select pg_temp.check((select reference = 'John 3:16' from public.daily_verses), 'the member reads the right verse');
select pg_temp.fails(format('insert into public.daily_verses (church_id, verse_date, reference, verse_text, created_by) values (%L, current_date + 2, ''Psalm 1:1'', ''x'', auth.uid())', :'church_a'),
  'a member cannot add a verse');
update public.daily_verses set reflection = 'Hijacked' where church_id = :'church_a';
delete from public.daily_verses where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 2 and bool_and(reflection <> 'Hijacked') from public.daily_verses),
  'a member can neither edit nor delete verses');

-- Elders read but do not write; pending people and other churches see nothing.
select pg_temp.act_as(:elder_a);
select pg_temp.check(pg_temp.count_of('select * from public.daily_verses') = 1, 'an elder reads the daily verse');
select pg_temp.fails(format('insert into public.daily_verses (church_id, verse_date, reference, verse_text, created_by) values (%L, current_date + 3, ''Psalm 1:1'', ''x'', auth.uid())', :'church_a'),
  'an elder cannot add a verse; the Pastor chooses it');
reset role;

select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of('select * from public.daily_verses') = 0,
  'someone still waiting for approval sees no verses');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.daily_verses') = 0,
  'another church''s Pastor sees none of this church''s verses');
select pg_temp.fails(format('insert into public.daily_verses (church_id, verse_date, reference, verse_text, created_by) values (%L, current_date + 4, ''Psalm 1:1'', ''x'', auth.uid())', :'church_a'),
  'another church''s Pastor cannot add a verse here');
delete from public.daily_verses where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 2 from public.daily_verses), 'another church''s Pastor cannot delete verses here');

-- The Pastor can remove a verse.
select pg_temp.act_as(:pastor_a);
delete from public.daily_verses where church_id = :'church_a' and verse_date = current_date + 7;
select pg_temp.check(pg_temp.count_of('select * from public.daily_verses') = 1, 'the Pastor can delete a scheduled verse');
reset role;

set role anon;
select pg_temp.fails('select * from public.daily_verses', 'signed-out visitors cannot read verses');
reset role;
