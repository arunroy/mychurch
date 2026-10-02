-- Song library: songs planned for a Sunday are kept for the church so planners can reuse them.

\set pastor_a '''aaaaaaaa-0000-0000-0013-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0013-000000000001'''
\set leader_a '''aaaaaaaa-0000-0000-0013-000000000003'''
\set member_a '''aaaaaaaa-0000-0000-0013-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'sla@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'slb@example.com', '{"full_name": "Pastor Ben"}'),
  (:leader_a, 'sll@example.com', '{"full_name": "Lena Leader"}'),
  (:member_a, 'slm@example.com', '{"full_name": "Mary Member"}');

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
select public.register_church('Library Church A', 'Springfield', 'a@sl.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Library Church B', 'Shelbyville', 'b@sl.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status, is_worship_leader) values
  (:'church_a', :leader_a, 'member', 'approved', true),
  (:'church_a', :member_a, 'member', 'approved', false);

-- Two Sundays in the past and one in the future
select (date_trunc('week', current_date)::date - 8) as past1 \gset
select (date_trunc('week', current_date)::date - 1) as past2 \gset
select (date_trunc('week', current_date)::date + 13) as later \gset

-- Planning fills the library
select pg_temp.act_as(:leader_a);
select public.save_worship_plan(:'church_a', :'past1', null, null, null, '', '[{"title":"Song One","artist":"Writer","link":"https://example.com/1","language":"ta","tags":["Praise","praise"," Communion "]},{"title":"Song Two","language":"en"}]');
reset role;
select pg_temp.check((select count(*) = 2 from public.church_songs where church_id = :'church_a'), 'songs planned for a Sunday are saved to the library');
select pg_temp.check((select language = 'ta' and tags = array['praise', 'communion'] from public.church_songs where title = 'Song One'), 'with their language and tidy tags, without repeats');
select pg_temp.check((select bool_and(song_id is not null) from public.worship_songs where church_id = :'church_a'), 'and each song in the plan points at its library entry');

-- Using a song again does not duplicate it
select pg_temp.act_as(:leader_a);
select public.save_worship_plan(:'church_a', :'past2', null, null, null, '', '[{"title":"song one","artist":"WRITER"},{"title":"Song Three"}]');
select public.save_worship_plan(:'church_a', :'later', null, null, null, '', '[{"title":"Song One","artist":"Writer"}]');
reset role;
select pg_temp.check((select count(*) = 3 from public.church_songs where church_id = :'church_a'), 'the same song in another Sunday is not added twice, whatever its capital letters');
select pg_temp.check((select language = 'ta' and link = 'https://example.com/1' and tags = array['praise', 'communion'] from public.church_songs where title = 'Song One'), 'and leaving out the details keeps what the library already knew');

-- How often and when
select pg_temp.act_as(:leader_a);
select pg_temp.check((select times_sung = 2 and last_sung = :'past2' and next_planned = :'later' from public.song_library(:'church_a') where title = 'Song One'), 'the library shows how often a song was sung, when last and when next');
select pg_temp.check((select times_sung = 1 and next_planned is null from public.song_library(:'church_a') where title = 'Song Two'), 'a song sung once has no next date');
select pg_temp.check((select count(*) = 3 from public.song_library(:'church_a')), 'every song is listed');
reset role;

-- Direct changes by planners
select pg_temp.act_as(:leader_a);
update public.church_songs set tags = array['christmas'], language = 'hi' where title = 'Song Three';
insert into public.church_songs (church_id, title, language, created_by) values (:'church_a', 'Added By Hand', 'kn', :leader_a);
select pg_temp.fails(format('insert into public.church_songs (church_id, title, created_by) values (%L, ''SONG one'', %L)', :'church_a', :leader_a), 'the same title and artist cannot be added twice');
select pg_temp.fails(format('insert into public.church_songs (church_id, title, language, created_by) values (%L, ''Odd'', ''xx'', %L)', :'church_a', :leader_a), 'the language must be one we know');
select pg_temp.fails(format('insert into public.church_songs (church_id, title, tags, created_by) values (%L, ''Odd'', array[''a'',''b'',''c'',''d'',''e'',''f''], %L)', :'church_a', :leader_a), 'five tags at most');
select pg_temp.fails(format('insert into public.church_songs (church_id, title, tags, created_by) values (%L, ''Odd'', array[''Loud''], %L)', :'church_a', :leader_a), 'tags are lower-case');
select pg_temp.fails(format('insert into public.church_songs (church_id, title, link, created_by) values (%L, ''Odd'', ''javascript:alert(1)'', %L)', :'church_a', :leader_a), 'a link must be a web link');
reset role;
select pg_temp.check((select language = 'hi' and tags = array['christmas'] from public.church_songs where title = 'Song Three'), 'a planner can retag and change the language of a song');

-- Who can see the library
select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.church_songs') = 0, 'a member cannot read the library');
select pg_temp.fails(format('select * from public.song_library(%L)', :'church_a'), 'nor ask for it');
select pg_temp.fails(format('insert into public.church_songs (church_id, title, created_by) values (%L, ''Mine'', %L)', :'church_a', :member_a), 'or add to it');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.church_songs') = 0, 'another church sees none');
select pg_temp.fails(format('select * from public.song_library(%L)', :'church_a'), 'and cannot ask for this one');
select pg_temp.fails(format('insert into public.church_songs (church_id, title, created_by) values (%L, ''Sneaky'', %L)', :'church_a', :pastor_b), 'or add to it');
reset role;
set role anon;
select pg_temp.fails('select * from public.church_songs', 'signed-out visitors cannot read it');
reset role;

-- Another church''s library is separate
select pg_temp.act_as(:pastor_b);
select public.save_worship_plan(:'church_b', :'later', null, null, null, '', '[{"title":"Song One","artist":"Writer"}]');
reset role;
select pg_temp.check((select count(*) = 1 from public.church_songs where church_id = :'church_b'), 'each church has its own library, even for a song with the same name');

-- Deleting a library song keeps the plans readable
select pg_temp.act_as(:leader_a);
delete from public.church_songs where title = 'Song Two';
reset role;
select pg_temp.check((select count(*) = 1 and bool_and(song_id is null) from public.worship_songs where title = 'Song Two'), 'deleting a library song keeps it in the plan it was used in');

-- Deleting a plan does not delete the song
select pg_temp.act_as(:leader_a);
delete from public.worship_plans where church_id = :'church_a' and service_date = :'later';
reset role;
select pg_temp.check((select count(*) = 1 from public.church_songs where church_id = :'church_a' and title = 'Song One'), 'deleting a plan keeps its songs in the library');
select pg_temp.act_as(:leader_a);
select pg_temp.check((select next_planned is null and times_sung = 2 from public.song_library(:'church_a') where title = 'Song One'), 'and the count follows the plans that remain');
reset role;
