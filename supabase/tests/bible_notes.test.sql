-- Bible notes: private to the person who wrote them, one per verse, no one else can see them.

\set user_a '''aaaaaaaa-0000-0000-0006-000000000001'''
\set user_b '''bbbbbbbb-0000-0000-0006-000000000001'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:user_a, 'nta@example.com', '{"full_name": "Nora Notes"}'),
  (:user_b, 'ntb@example.com', '{"full_name": "Ned Notes"}');

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

select pg_temp.act_as(:user_a);
insert into public.bible_notes (user_id, book, chapter, verse, body) values (:user_a, 'John', 3, 16, 'God so loved the world.');
insert into public.bible_notes (user_id, book, chapter, verse, body) values (:user_a, 'Psalms', 23, 1, 'My shepherd.');
select pg_temp.check(pg_temp.count_of('select * from public.bible_notes') = 2, 'a person can write and read their own notes');
select pg_temp.fails(format('insert into public.bible_notes (user_id, book, chapter, verse, body) values (%L, ''John'', 3, 16, ''again'')', :user_a),
  'only one note per verse');
select pg_temp.fails(format('insert into public.bible_notes (user_id, book, chapter, verse, body) values (%L, ''John'', 1, 1, ''   '')', :user_a),
  'a note cannot be blank');
select pg_temp.fails(format('insert into public.bible_notes (user_id, book, chapter, verse, body) values (%L, ''John'', 0, 1, ''x'')', :user_a),
  'chapter must be a real number');
select pg_temp.fails(format('insert into public.bible_notes (user_id, book, chapter, verse, body) values (%L, ''John'', 1, 1, ''x'')', :user_b),
  'a person cannot write a note as someone else');
update public.bible_notes set body = 'Updated.', updated_at = now() where book = 'John';
select pg_temp.check((select body = 'Updated.' from public.bible_notes where book = 'John'), 'a person can edit their note');
select pg_temp.fails('update public.bible_notes set book = ''Mark'' where book = ''John''', 'but only the text, not which verse it is on');
reset role;

select pg_temp.act_as(:user_b);
select pg_temp.check(pg_temp.count_of('select * from public.bible_notes') = 0, 'someone else sees none of them');
update public.bible_notes set body = 'hacked';
delete from public.bible_notes;
reset role;
select pg_temp.check((select count(*) = 2 and bool_and(body <> 'hacked') from public.bible_notes), 'and cannot change or delete them');

select pg_temp.act_as(:user_a);
delete from public.bible_notes where book = 'Psalms';
reset role;
select pg_temp.check((select count(*) = 1 from public.bible_notes), 'a person can delete their own note');

set role anon;
select pg_temp.fails('select * from public.bible_notes', 'signed-out visitors cannot read notes');
reset role;

-- Notes go when the account does.
delete from auth.users where id = :user_a;
select pg_temp.check((select count(*) = 0 from public.bible_notes), 'notes are deleted with the account');
