-- Chat groups: the Pastor and elders manage them, only members read them, General is untouched.

\set pastor_a '''aaaaaaaa-0000-0000-0009-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0009-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0009-000000000002'''
\set admin_a '''aaaaaaaa-0000-0000-0009-000000000003'''
\set food_1 '''aaaaaaaa-0000-0000-0009-000000000004'''
\set food_2 '''aaaaaaaa-0000-0000-0009-000000000005'''
\set outsider '''aaaaaaaa-0000-0000-0009-000000000006'''
\set pending_a '''aaaaaaaa-0000-0000-0009-000000000007'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'cga@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'cgb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'cge@example.com', '{"full_name": "Eli Elder"}'),
  (:admin_a, 'cgd@example.com', '{"full_name": "Ada Admin"}'),
  (:food_1, 'cg1@example.com', '{"full_name": "Fiona Food"}'),
  (:food_2, 'cg2@example.com', '{"full_name": "Fred Food"}'),
  (:outsider, 'cg3@example.com', '{"full_name": "Olive Outside"}'),
  (:pending_a, 'cgp@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Group Church A', 'Springfield', 'a@group.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Group Church B', 'Shelbyville', 'b@group.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :admin_a, 'admin', 'approved'),
  (:'church_a', :food_1, 'member', 'approved'),
  (:'church_a', :food_2, 'member', 'approved'),
  (:'church_a', :outsider, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Creating groups
select pg_temp.act_as(:elder_a);
select public.create_chat_group(:'church_a', 'Food committee', 'Meals and fellowship lunches', array[:elder_a, :food_1, :food_2]::uuid[]) as food \gset
select pg_temp.check(:'food' is not null, 'an elder can create a group');
select pg_temp.fails(format('select public.create_chat_group(%L, ''food committee'', '''', array[]::uuid[])', :'church_a'), 'group names are unique, ignoring case');
select pg_temp.fails(format('select public.create_chat_group(%L, ''   '', '''', array[]::uuid[])', :'church_a'), 'a group needs a name');
select pg_temp.fails(format('select public.create_chat_group(%L, ''Bad members'', '''', array[%L]::uuid[])', :'church_a', :pending_a), 'someone still waiting for approval cannot be added');
select pg_temp.fails(format('select public.create_chat_group(%L, ''Other church'', '''', array[%L]::uuid[])', :'church_a', :pastor_b), 'nor someone from another church');
reset role;

select pg_temp.act_as(:admin_a);
select pg_temp.fails(format('select public.create_chat_group(%L, ''Admin group'', '''', array[]::uuid[])', :'church_a'), 'a church admin cannot create a group');
select pg_temp.fails(format('select * from public.manageable_chat_groups(%L)', :'church_a'), 'or list them for managing');
reset role;
select pg_temp.act_as(:food_1);
select pg_temp.fails(format('select public.create_chat_group(%L, ''Member group'', '''', array[]::uuid[])', :'church_a'), 'nor can a member');
select pg_temp.fails('select * from public.chat_groups', 'the group tables cannot be read directly');
reset role;

-- Posting and reading
select pg_temp.act_as(:food_1);
insert into public.church_chat_messages (church_id, sender_id, body, group_id) values (:'church_a', :food_1, 'Who is cooking Sunday?', :'food');
insert into public.church_chat_messages (church_id, sender_id, body) values (:'church_a', :food_1, 'Hello everyone');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_chat_feed(%L, 50, %L)', :'church_a', :'food')) = 1, 'a member reads their group''s messages');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_chat_feed(%L, 50)', :'church_a')) = 1, 'General shows only General messages');
reset role;

select pg_temp.act_as(:food_2);
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages where group_id is not null') = 1, 'another member of the group reads it too');
reset role;

select pg_temp.act_as(:outsider);
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages where group_id is not null') = 0, 'a church member outside the group cannot read it');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_chat_feed(%L, 50, %L)', :'church_a', :'food')) = 0, 'not through the feed either');
select pg_temp.fails(format('insert into public.church_chat_messages (church_id, sender_id, body, group_id) values (%L, %L, ''Sneaking in'', %L)', :'church_a', :outsider, :'food'), 'and cannot post in it');
select pg_temp.fails(format('select * from public.chat_group_members_list(%L)', :'food'), 'or see who is in it');
select pg_temp.check(pg_temp.count_of(format('select * from public.my_chat_groups(%L)', :'church_a')) = 0, 'it is not in their list of groups');
insert into public.church_chat_messages (church_id, sender_id, body) values (:'church_a', :outsider, 'General is open to all');
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages where group_id is null') = 2, 'General still works for every member');
reset role;

-- The Pastor is not in the group: private means private, but they can manage it
select pg_temp.act_as(:pastor_a);
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages where group_id is not null') = 0, 'the Pastor cannot read a group they are not in');
select pg_temp.check(pg_temp.count_of(format('select * from public.church_chat_feed(%L, 50, %L)', :'church_a', :'food')) = 0, 'not through the feed');
select pg_temp.check((select count(*) = 1 and bool_and(not i_am_member) and bool_and(member_count = 3) from public.manageable_chat_groups(:'church_a')), 'but sees it in the list to manage, with its size');
select pg_temp.check(pg_temp.count_of(format('select * from public.chat_group_members_list(%L)', :'food')) = 3, 'and can see who is in it');
select pg_temp.fails(format('insert into public.church_chat_messages (church_id, sender_id, body, group_id) values (%L, %L, ''Not a member'', %L)', :'church_a', :pastor_a, :'food'), 'and cannot post in it');
select public.update_chat_group(:'food', 'Food team', 'Meals');
select pg_temp.check((select name = 'Food team' from public.manageable_chat_groups(:'church_a')), 'the Pastor can rename a group');
reset role;

-- Unread
select pg_temp.act_as(:food_2);
select pg_temp.check((select unread = 1 from public.chat_unread_counts(:'church_a') where group_id = :'food'), 'a group member has one unread message in the group');
select pg_temp.check((select unread = 2 from public.chat_unread_counts(:'church_a') where group_id is null), 'and General counts only General messages');
select public.mark_chat_group_read(:'food');
select pg_temp.check((select unread = 0 from public.chat_unread_counts(:'church_a') where group_id = :'food'), 'reading the group clears its count');
reset role;
select pg_temp.act_as(:outsider);
select pg_temp.check(pg_temp.count_of(format('select * from public.chat_unread_counts(%L)', :'church_a')) = 1, 'someone outside the group has only the General row');
reset role;

-- Deleting messages
select pg_temp.act_as(:food_2);
delete from public.church_chat_messages where group_id is not null;
reset role;
select pg_temp.check((select count(*) = 1 from public.church_chat_messages where group_id is not null), 'a member cannot remove someone else''s group message');
select pg_temp.act_as(:pastor_a);
delete from public.church_chat_messages where group_id is not null;
reset role;
select pg_temp.check((select count(*) = 1 from public.church_chat_messages where group_id is not null), 'a Pastor outside the group cannot remove its messages');
select pg_temp.act_as(:elder_a);
delete from public.church_chat_messages where group_id is not null;
reset role;
select pg_temp.check((select count(*) = 0 from public.church_chat_messages where group_id is not null), 'an elder who is in the group can');

-- Changing who is in it
select pg_temp.act_as(:food_1);
insert into public.church_chat_messages (church_id, sender_id, body, group_id) values (:'church_a', :food_1, 'Another message', :'food');
reset role;
select pg_temp.act_as(:elder_a);
select public.set_chat_group_members(:'food', array[:elder_a, :food_1, :outsider]::uuid[]);
select pg_temp.fails(format('select public.set_chat_group_members(%L, array[%L]::uuid[])', :'food', :pending_a), 'the member list only takes approved members');
reset role;
select pg_temp.act_as(:food_2);
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages where group_id is not null') = 0, 'someone taken out of a group loses it');
reset role;
select pg_temp.act_as(:outsider);
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages where group_id is not null') = 1, 'and someone put in gains it');
reset role;

-- Someone removed from the church loses their groups with it
delete from public.memberships where church_id = :'church_a' and user_id = :food_1;
select pg_temp.act_as(:food_1);
select pg_temp.check(pg_temp.count_of('select * from public.church_chat_messages where group_id is not null') = 0, 'a person removed from the church loses their groups');
reset role;

-- Deleting a group
select pg_temp.act_as(:food_2);
select pg_temp.fails(format('select public.delete_chat_group(%L)', :'food'), 'a member cannot delete a group');
reset role;
select pg_temp.act_as(:pastor_a);
select public.delete_chat_group(:'food');
reset role;
select pg_temp.check((select count(*) = 0 from public.chat_groups) and (select count(*) = 0 from public.church_chat_messages where group_id is not null), 'deleting a group removes it and its messages');
select pg_temp.check((select count(*) = 2 from public.church_chat_messages where group_id is null), 'but not General');

-- Another church sees none of it
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select public.create_chat_group(%L, ''Intruder'', '''', array[]::uuid[])', :'church_a'), 'another church''s Pastor cannot create a group here');
reset role;

set role anon;
select pg_temp.fails(format('select * from public.church_chat_feed(%L, 10, null)', :'church_a'), 'signed-out visitors cannot read chat');
reset role;
