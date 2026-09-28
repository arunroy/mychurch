-- Phase 0 rules: church sign-up, verification, joining, approval, roles, and
-- above all that one church can never see another church's data.

\set pastor_a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0000-000000000001'''
\set member_a '''aaaaaaaa-0000-0000-0000-000000000002'''
\set elder_a '''aaaaaaaa-0000-0000-0000-000000000003'''
\set outsider '''cccccccc-0000-0000-0000-000000000001'''
\set platform '''dddddddd-0000-0000-0000-000000000001'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'pa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'pb@example.com', '{"full_name": "Pastor Ben"}'),
  (:member_a, 'ma@example.com', '{"full_name": "Mary Member"}'),
  (:elder_a, 'ea@example.com', '{"full_name": "Eli Elder"}'),
  (:outsider, 'o@example.com', '{"full_name": "Olive Outsider"}'),
  (:platform, 'admin@example.com', '{"full_name": "Platform Admin"}');
insert into public.platform_admins (user_id) values (:platform);

-- Test helpers (owned by postgres, callable by anyone in this session).
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

-- Two pastors register two churches.
select pg_temp.act_as(:pastor_a);
select public.register_church('Grace Chapel', 'Springfield', 'office@grace.example', '#2F9E44') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Hope Fellowship', 'Shelbyville', 'hi@hope.example') as church_b \gset
reset role;

select pg_temp.act_as(:pastor_a);
select pg_temp.check((select status = 'pending' from public.churches where id = :'church_a'),
  'a new church starts pending verification');
select pg_temp.check((select role = 'pastor' and status = 'approved' from public.memberships
  where church_id = :'church_a' and user_id = auth.uid()), 'the registering user becomes its approved Pastor');
select code as code_a from public.church_join_codes where church_id = :'church_a' \gset
select pg_temp.check(:'code_a' ~ '^[A-Z2-9]{8}$', 'the Pastor can read the join code');
select pg_temp.fails(format('select public.set_church_status(%L, ''active'')', :'church_a'),
  'a Pastor cannot verify their own church');
reset role;

-- Nobody can join a church that has not been verified.
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.join_church_by_code(%L)', :'code_a'),
  'joining an unverified church fails');
select pg_temp.check(pg_temp.count_of('select * from public.search_churches(''Grace'')') = 0,
  'unverified churches are not searchable');
reset role;

-- The platform admin verifies both.
select pg_temp.act_as(:platform);
select pg_temp.check(pg_temp.count_of('select * from public.list_churches_for_review()') = 2,
  'platform admin sees both churches waiting for review');
select public.set_church_status(:'church_a', 'active');
select public.set_church_status(:'church_b', 'active');
reset role;

select pg_temp.act_as(:outsider);
select pg_temp.fails('select * from public.list_churches_for_review()',
  'ordinary users cannot list churches for review');
select pg_temp.check(pg_temp.count_of('select * from public.search_churches(''grace'')') = 1,
  'verified churches are searchable, case-insensitively');
select pg_temp.check(pg_temp.count_of('select * from public.churches') = 0,
  'searching does not open up the churches table');
reset role;

-- A member joins church A with the code and waits for approval.
select pg_temp.act_as(:member_a);
select pg_temp.check(public.join_church_by_code(lower(' ' || :'code_a' || ' ')) = :'church_a',
  'join codes ignore case and spaces');
select pg_temp.check((select status = 'pending' from public.memberships
  where church_id = :'church_a' and user_id = auth.uid()), 'a new member starts pending');
select pg_temp.check(pg_temp.count_of('select * from public.churches') = 1,
  'a pending member sees their own church');
select pg_temp.check(pg_temp.count_of('select * from public.church_join_codes') = 0,
  'members cannot read join codes');
select pg_temp.check(pg_temp.count_of(format('select * from public.memberships where church_id = %L', :'church_a')) = 1,
  'a pending member sees only their own membership');
select pg_temp.fails(format('select public.approve_member(%L, %L)', :'church_a', :member_a),
  'a member cannot approve themselves');
select pg_temp.fails(format('insert into public.memberships (church_id, user_id, role, status) values (%L, %L, ''pastor'', ''approved'')',
  :'church_b', :member_a), 'memberships cannot be inserted directly');
select pg_temp.fails(format('update public.memberships set role = ''pastor'' where user_id = %L', :member_a),
  'a member cannot change their own role');
reset role;

-- Pastor B has no power over church A.
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select public.approve_member(%L, %L)', :'church_a', :member_a),
  'another church''s Pastor cannot approve members here');
select pg_temp.check(pg_temp.count_of(format('select * from public.memberships where church_id = %L', :'church_a')) = 0,
  'another church''s Pastor sees none of this church''s members');
select pg_temp.check(pg_temp.count_of(format('select * from public.churches where id = %L', :'church_a')) = 0,
  'another church''s Pastor cannot see this church');
select pg_temp.check(pg_temp.count_of(format('select * from public.profiles where id = %L', :pastor_a)) = 0,
  'another church''s Pastor cannot see this church''s people');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_join_codes where church_id = %L', :'church_a')) = 0,
  'another church''s Pastor cannot read this church''s join code');
select pg_temp.fails(format('select public.regenerate_join_code(%L)', :'church_a'),
  'another church''s Pastor cannot change this church''s code');
update public.churches set name = 'Hijacked' where id = :'church_a';
reset role;
select pg_temp.check((select name = 'Grace Chapel' from public.churches where id = :'church_a'),
  'another church''s Pastor cannot rename this church');

-- Pastor A sees the request and approves it.
select pg_temp.act_as(:pastor_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.memberships where church_id = %L and status = ''pending''', :'church_a')) = 1,
  'the Pastor sees pending requests');
select pg_temp.check(pg_temp.count_of(format('select * from public.profiles where id = %L', :member_a)) = 1,
  'the Pastor can see who is asking to join');
select public.approve_member(:'church_a', :member_a);
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.memberships where church_id = %L', :'church_a')) = 2,
  'an approved member sees the church directory');
select pg_temp.check(pg_temp.count_of(format('select * from public.profiles where id = %L', :pastor_a)) = 1,
  'an approved member sees fellow members'' profiles');
select pg_temp.check(pg_temp.count_of(format('select * from public.profiles where id = %L', :pastor_b)) = 0,
  'but not people from other churches');
select pg_temp.check(pg_temp.count_of(format('select * from public.churches where id = %L', :'church_b')) = 0,
  'and not other churches');
select pg_temp.fails(format('update public.churches set status = ''active'' where id = %L', :'church_a'),
  'nobody can change a church''s status by editing the row');
update public.churches set name = 'Renamed by member' where id = :'church_a';
update public.memberships set directory_visible = false where user_id = auth.uid();
reset role;
select pg_temp.check((select name = 'Grace Chapel' from public.churches where id = :'church_a'),
  'members cannot edit church settings');
select pg_temp.check((select not directory_visible from public.memberships
  where church_id = :'church_a' and user_id = :member_a), 'members can hide themselves from the directory');

select pg_temp.act_as(:outsider);
select pg_temp.check(pg_temp.count_of(format('select * from public.profiles where id = %L', :member_a)) = 0,
  'outsiders see nobody');
reset role;

-- Hidden members drop out of the directory for other members but not for leaders.
select pg_temp.act_as(:elder_a);
select public.join_church_by_code(:'code_a');
reset role;
select pg_temp.act_as(:pastor_a);
select public.approve_member(:'church_a', :elder_a);
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.profiles where id = %L', :member_a)) = 0,
  'a member who hid themselves is not in the directory');
reset role;

-- Roles.
select pg_temp.act_as(:pastor_a);
select public.set_member_role(:'church_a', :elder_a, 'elder');
select pg_temp.fails(format('select public.set_member_role(%L, %L, ''member'')', :'church_a', :pastor_a),
  'the last Pastor cannot step down');
select pg_temp.fails(format('select public.remove_member(%L, %L)', :'church_a', :pastor_a),
  'the last Pastor cannot leave');
reset role;

select pg_temp.act_as(:elder_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.profiles where id = %L', :member_a)) = 1,
  'elders see everyone, including hidden members');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_join_codes where church_id = %L', :'church_a')) = 1,
  'elders can read the join code to share it');
select pg_temp.fails(format('select public.set_member_role(%L, %L, ''elder'')', :'church_a', :member_a),
  'elders cannot change roles');
select pg_temp.fails(format('select public.remove_member(%L, %L)', :'church_a', :pastor_a),
  'elders cannot remove the Pastor');
select pg_temp.fails(format('select public.regenerate_join_code(%L)', :'church_a'),
  'elders cannot change the join code');
reset role;

-- Leaving and removal.
select pg_temp.act_as(:outsider);
select public.request_to_join(:'church_a');
reset role;
select pg_temp.act_as(:elder_a);
select public.remove_member(:'church_a', :outsider);
reset role;
select pg_temp.check(not exists (select 1 from public.memberships where user_id = :outsider),
  'elders can decline a join request');

select pg_temp.act_as(:member_a);
select public.remove_member(:'church_a', :member_a);
reset role;
select pg_temp.check(not exists (select 1 from public.memberships where user_id = :member_a),
  'members can leave');

-- Churches that skip approval let code-holders straight in.
update public.churches set requires_approval = false where id = :'church_b';
select code as code_b from public.church_join_codes where church_id = :'church_b' \gset
select pg_temp.act_as(:member_a);
select public.join_church_by_code(:'code_b');
select pg_temp.check((select status = 'approved' from public.memberships where church_id = :'church_b' and user_id = auth.uid()),
  'with approval turned off, a code joins straight away');
reset role;

-- Storage: logos by church leaders only, avatars by their owner only.
select pg_temp.act_as(:pastor_a);
insert into storage.objects (bucket_id, name) values ('church-logos', :'church_a' || '/logo.png');
select pg_temp.check(true, 'the Pastor can upload the church logo');
select pg_temp.fails(format('insert into storage.objects (bucket_id, name) values (''church-logos'', %L)', :'church_b' || '/logo.png'),
  'a Pastor cannot upload another church''s logo');
select pg_temp.fails(format('insert into storage.objects (bucket_id, name) values (''avatars'', %L)', :member_a || '/me.jpg'),
  'nobody can upload someone else''s photo');
reset role;

-- Push tokens.
select pg_temp.act_as(:member_a);
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[a]', auth.uid(), 'ios');
select pg_temp.fails(format('insert into public.push_tokens (token, user_id, platform) values (''ExponentPushToken[b]'', %L, ''ios'')', :pastor_a),
  'nobody can register a device for someone else');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.check(pg_temp.count_of('select * from public.push_tokens') = 0, 'push tokens are private');
reset role;

-- Anonymous callers get nothing.
set role anon;
select pg_temp.fails('select * from public.churches', 'signed-out visitors cannot read churches');
select pg_temp.fails('select public.search_churches(''grace'')', 'signed-out visitors cannot search');
reset role;
