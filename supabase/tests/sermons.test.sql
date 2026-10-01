-- Sermon rules: leaders add and edit, members read only what is published, drafts stay with
-- leaders, links must be web links, and one church never sees another's sermons.

\set pastor_a '''aaaaaaaa-0000-0000-0005-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0005-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0005-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0005-000000000003'''
\set pending_a '''aaaaaaaa-0000-0000-0005-000000000004'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'spa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'spb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'sea@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'sma@example.com', '{"full_name": "Mary Member"}'),
  (:pending_a, 'spe@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Sermon Church A', 'Springfield', 'a@sermon.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Sermon Church B', 'Shelbyville', 'b@sermon.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Leaders add sermons: one published with a reading link, one draft with a video link.
select pg_temp.act_as(:elder_a);
insert into public.sermons (church_id, created_by, title, speaker, sermon_date, reference, book, chapter, verse_start, verse_end, read_url)
values (:'church_a', :elder_a, 'From Ambition to Purpose', 'Pastor Renji George', current_date, 'John 3:16-18', 'John', 3, 16, 18,
        'https://sermoncentral.com/sermons/example-306136');
insert into public.sermons (church_id, created_by, title, sermon_date, media_url, published)
values (:'church_a', :elder_a, 'Next Sunday (draft)', current_date + 7, 'https://youtu.be/example', false);
select pg_temp.check(pg_temp.count_of('select * from public.sermons') = 2, 'a leader sees the published sermon and the draft');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''Not mine'', current_date, ''https://example.com'')', :'church_a', :pastor_a),
  'a sermon cannot be added in someone else''s name');
reset role;

-- The database refuses bad links, missing links and impossible passages.
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date) values (%L, %L, ''No links'', current_date)', :'church_a', :elder_a),
  'a sermon needs at least one link');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''Bad link'', current_date, ''javascript:alert(1)'')', :'church_a', :elder_a),
  'a link must be a web link');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''Odd link'', current_date, ''ftp://example.com/x'')', :'church_a', :elder_a),
  'only http and https links are accepted');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url, verse_start, verse_end) values (%L, %L, ''Backwards'', current_date, ''https://example.com'', 10, 3)', :'church_a', :elder_a),
  'a passage cannot end before it starts');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''   '', current_date, ''https://example.com'')', :'church_a', :elder_a),
  'a sermon needs a title');

-- Members read only what is published.
select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.sermons') = 1, 'a member sees the published sermon but not the draft');
select pg_temp.check((select title = 'From Ambition to Purpose' from public.sermons), 'and it is the published one');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''Member sermon'', current_date, ''https://example.com'')', :'church_a', :member_a),
  'a member cannot add a sermon');
update public.sermons set title = 'Hijacked' where church_id = :'church_a';
delete from public.sermons where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 2 and bool_and(title <> 'Hijacked') from public.sermons), 'a member can neither edit nor remove sermons');

-- Pending people, other churches and signed-out visitors see nothing.
select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of('select * from public.sermons') = 0, 'someone waiting for approval sees no sermons');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.sermons') = 0, 'another church''s Pastor sees none of these sermons');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''Cross-church'', current_date, ''https://example.com'')', :'church_a', :pastor_b),
  'and cannot add one here');
delete from public.sermons where church_id = :'church_a';
reset role;
select pg_temp.check((select count(*) = 2 from public.sermons), 'and cannot remove any here');

set role anon;
select pg_temp.fails('select * from public.sermons', 'signed-out visitors cannot read sermons');
reset role;

-- A leader publishes the draft, edits it, and removes a sermon.
select pg_temp.act_as(:pastor_a);
update public.sermons set published = true, title = 'Next Sunday', updated_at = now() where title = 'Next Sunday (draft)';
select pg_temp.check((select published and title = 'Next Sunday' from public.sermons where sermon_date = current_date + 7), 'a leader can publish and edit a draft');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.sermons') = 2, 'and members then see it');
reset role;

select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('update public.sermons set church_id = %L where sermon_date = current_date', :'church_b'),
  'a sermon cannot be moved to another church');
delete from public.sermons where title = 'Next Sunday';
reset role;
select pg_temp.check((select count(*) = 1 from public.sermons), 'a leader can remove a sermon');
