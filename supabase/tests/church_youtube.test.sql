-- Church YouTube channel: only the checked-channel function can set it (not the app), members can read it.

\set pastor_a '''aaaaaaaa-0000-0000-0007-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0007-000000000001'''
\set member_a '''aaaaaaaa-0000-0000-0007-000000000003'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'yta@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'ytb@example.com', '{"full_name": "Pastor Ben"}'),
  (:member_a, 'ytm@example.com', '{"full_name": "Mary Member"}');

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
select public.register_church('Video Church A', 'Springfield', 'a@video.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Video Church B', 'Shelbyville', 'b@video.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values (:'church_a', :member_a, 'member', 'approved');

-- Nobody can write the channel columns from the app, not even the Pastor.
select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('update public.churches set youtube_url = ''https://www.youtube.com/@grace'' where id = %L', :'church_a'),
  'the Pastor cannot set the channel link straight from the app');
select pg_temp.fails(format('update public.churches set youtube_channel_id = ''UC_x5XG1OV2P6uZZ5FSM9Ttw'' where id = %L', :'church_a'),
  'nor the channel id');
select pg_temp.fails(format('update public.churches set youtube_last_published_at = now() where id = %L', :'church_a'),
  'nor which video was last announced');
-- Other settings still work.
update public.churches set city = 'Springfield East' where id = :'church_a';
select pg_temp.check((select city = 'Springfield East' from public.churches where id = :'church_a'), 'the Pastor can still change other settings');
reset role;

-- The function writes as the service role (the owner here), and the database checks what it writes.
update public.churches set youtube_url = 'https://www.youtube.com/@grace', youtube_channel_id = 'UC_x5XG1OV2P6uZZ5FSM9Ttw' where id = :'church_a';
select pg_temp.check((select youtube_channel_id = 'UC_x5XG1OV2P6uZZ5FSM9Ttw' from public.churches where id = :'church_a'), 'the function can save a channel');
select pg_temp.fails(format('update public.churches set youtube_channel_id = ''not-a-channel'' where id = %L', :'church_a'), 'a channel id must look like one');
select pg_temp.fails(format('update public.churches set youtube_url = '''' where id = %L', :'church_a'), 'a channel link cannot be empty text (use null to remove)');

update public.churches set youtube_last_video_id = 'abc123', youtube_last_published_at = now() where id = :'church_a';
select pg_temp.check((select youtube_last_video_id = 'abc123' from public.churches where id = :'church_a'), 'the function can record the last announced video');

-- Members read it with the church.
select pg_temp.act_as(:member_a);
select pg_temp.check((select youtube_channel_id is not null from public.churches where id = :'church_a'), 'a member can read the church''s channel');
reset role;

-- Another church's people do not see it.
select pg_temp.act_as(:pastor_b);
select pg_temp.check(not exists (select 1 from public.churches where id = :'church_a'), 'another church''s Pastor cannot read it');
reset role;

set role anon;
select pg_temp.fails('select youtube_channel_id from public.churches', 'signed-out visitors cannot read churches');
reset role;
