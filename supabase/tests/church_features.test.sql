-- Church features: off until the Pastor turns them on, and only the Pastor can.

\set pastor_a '''aaaaaaaa-0000-0000-0014-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0014-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0014-000000000002'''
\set admin_a '''aaaaaaaa-0000-0000-0014-000000000003'''
\set member_a '''aaaaaaaa-0000-0000-0014-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'cfa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'cfb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'cfe@example.com', '{"full_name": "Eli Elder"}'),
  (:admin_a, 'cfd@example.com', '{"full_name": "Ada Admin"}'),
  (:member_a, 'cfm@example.com', '{"full_name": "Mary Member"}');

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
select public.register_church('Features Church A', 'Springfield', 'a@cf.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Features Church B', 'Shelbyville', 'b@cf.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :admin_a, 'admin', 'approved'),
  (:'church_a', :member_a, 'member', 'approved');

-- Off by default
select pg_temp.check((select enabled_features = '{}' from public.churches where id = :'church_a'), 'a new church starts with every feature off');

-- Only the Pastor changes them
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.set_church_features(%L, array[''bible''])', :'church_a'), 'an elder cannot choose the features');
reset role;
select pg_temp.act_as(:admin_a);
select pg_temp.fails(format('select public.set_church_features(%L, array[''bible''])', :'church_a'), 'nor can a church admin');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.set_church_features(%L, array[''bible''])', :'church_a'), 'nor a member');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select public.set_church_features(%L, array[''bible''])', :'church_a'), 'nor another church''s Pastor');
reset role;

-- The column cannot be written directly, even by the people who edit church settings
select pg_temp.act_as(:admin_a);
select pg_temp.fails(format('update public.churches set enabled_features = array[''bible''] where id = %L', :'church_a'), 'a church admin cannot write the list directly');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('update public.churches set enabled_features = array[''bible''] where id = %L', :'church_a'), 'nor can the Pastor, who goes through the function');
reset role;
select pg_temp.check((select enabled_features = '{}' from public.churches where id = :'church_a'), 'and nothing changed');

-- The Pastor chooses
select pg_temp.act_as(:pastor_a);
select public.set_church_features(:'church_a', array['prayer', 'bible', 'prayer', 'chat']);
reset role;
select pg_temp.check((select enabled_features = array['bible', 'chat', 'prayer'] from public.churches where id = :'church_a'), 'the Pastor turns features on, sorted and without repeats');
select pg_temp.check((select enabled_features = '{}' from public.churches where id = :'church_b'), 'another church is not affected');

select pg_temp.act_as(:member_a);
select pg_temp.check((select enabled_features = array['bible', 'chat', 'prayer'] from public.churches where id = :'church_a'), 'members can see which features are on');
reset role;

select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('select public.set_church_features(%L, array[''bible'', ''teleporter''])', :'church_a'), 'a feature that does not exist is refused');
select pg_temp.check((select count(*) = 17 from unnest(public.known_church_features())), 'there are 17 switchable features');
select public.set_church_features(:'church_a', public.known_church_features());
select pg_temp.check((select cardinality(enabled_features) = 17 from public.churches where id = :'church_a'), 'the Pastor can turn all of them on');
select public.set_church_features(:'church_a', '{}');
select public.set_church_features(:'church_a', null);
reset role;
select pg_temp.check((select enabled_features = '{}' from public.churches where id = :'church_a'), 'and all of them off again');
