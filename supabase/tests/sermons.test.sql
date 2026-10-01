-- Sermon rules: the Pastor adds the church's own; members add articles and outside links that wait for
-- the Pastor's review; only approved entries reach every member; links must be web links; and one
-- church never sees another's sermons.

\set pastor_a '''aaaaaaaa-0000-0000-0005-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0005-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0005-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0005-000000000003'''
\set member_a2 '''aaaaaaaa-0000-0000-0005-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0005-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'spa@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'spb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'sea@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'sma@example.com', '{"full_name": "Mary Member"}'),
  (:member_a2, 'sma2@example.com', '{"full_name": "Mark Member"}'),
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
  (:'church_a', :member_a2, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- The Pastor adds the church's own sermons: one with a link, one with text only, and a draft.
select pg_temp.act_as(:pastor_a);
insert into public.sermons (church_id, created_by, title, speaker, sermon_date, reference, book, chapter, verse_start, verse_end, read_url)
values (:'church_a', :pastor_a, 'From Ambition to Purpose', 'Pastor Anna', current_date, 'John 3:16-18', 'John', 3, 16, 18, 'https://sermoncentral.com/sermons/example-306136');
insert into public.sermons (church_id, created_by, title, sermon_date, body)
values (:'church_a', :pastor_a, 'Grace in a few words', current_date - 7, 'Grace is a gift we cannot earn.');
insert into public.sermons (church_id, created_by, title, sermon_date, media_url, published)
values (:'church_a', :pastor_a, 'Next Sunday (draft)', current_date + 7, 'https://youtu.be/example', false);
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''Not mine'', current_date, ''https://example.com'')', :'church_a', :elder_a),
  'a sermon cannot be added in someone else''s name');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url, source) values (%L, %L, ''Fake member article'', current_date, ''https://example.com'', ''member'')', :'church_a', :pastor_a),
  'even the Pastor cannot insert member sermons directly');
reset role;

-- Nobody else can add the church's own sermons directly, nor can they skip review.
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''Elder sermon'', current_date, ''https://example.com'')', :'church_a', :elder_a),
  'an elder cannot add the Pastor''s sermons directly');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url, source, status) values (%L, %L, ''Skip review'', current_date, ''https://example.com'', ''external'', ''approved'')', :'church_a', :member_a),
  'a member cannot insert directly and skip review');
reset role;

-- The database refuses bad content.
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date) values (%L, %L, ''Nothing in it'', current_date)', :'church_a', :pastor_a),
  'a sermon needs text or a link');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''Bad link'', current_date, ''javascript:alert(1)'')', :'church_a', :pastor_a),
  'a link must be a web link');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url, verse_start, verse_end) values (%L, %L, ''Backwards'', current_date, ''https://example.com'', 10, 3)', :'church_a', :pastor_a),
  'a passage cannot end before it starts');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, read_url) values (%L, %L, ''   '', current_date, ''https://example.com'')', :'church_a', :pastor_a),
  'a sermon needs a title');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, source, read_url) values (%L, %L, ''Article without text'', current_date, ''member'', ''https://example.com'')', :'church_a', :member_a),
  'a member article needs text');
select pg_temp.fails(format('insert into public.sermons (church_id, created_by, title, sermon_date, source, body) values (%L, %L, ''Outside sermon without a link'', current_date, ''external'', ''A note'')', :'church_a', :member_a),
  'an outside sermon needs a link');

-- What members see of the Pastor's own sermons: published ones only, and no author name.
select pg_temp.act_as(:member_a);
select pg_temp.check((select count(*) = 2 and bool_and(source = 'pastor') and bool_and(author_name is null) from public.sermon_feed(:'church_a')),
  'a member sees the Pastor''s two published sermons, with no author name, but not the draft');
reset role;

-- A member writes an article and another suggests an outside sermon; both wait for review.
select pg_temp.act_as(:member_a);
select public.submit_sermon(:'church_a', 'member', 'Why I pray in the morning', '', 'Psalm 5:3', 'Psalms', 5, 3, 3,
  'In the morning, Lord, you hear my voice. I bring my day to him first.', null) as article_id \gset
reset role;
select pg_temp.act_as(:member_a2);
select public.submit_sermon(:'church_a', 'external', 'A talk on forgiveness', 'Some Preacher', '', null, null, null, null,
  'Helped me forgive my brother.', 'https://example.org/forgiveness') as link_id \gset
select pg_temp.fails(format('select public.submit_sermon(%L, ''member'', ''No text'', '''', '''', null, null, null, null, null, null)', :'church_a'),
  'an article without text is refused');
select pg_temp.fails(format('select public.submit_sermon(%L, ''external'', ''Bad link'', '''', '''', null, null, null, null, null, ''ftp://x'')', :'church_a'),
  'an outside sermon needs an https link');
select pg_temp.fails(format('select public.submit_sermon(%L, ''pastor'', ''Pretend Pastor'', '''', '''', null, null, null, null, ''x'', null)', :'church_a'),
  'a member cannot add a sermon as the Pastor');
reset role;
select pg_temp.check((select status = 'pending' from public.sermons where id = :'article_id'), 'a new article is waiting for review');
select pg_temp.check((select status = 'pending' from public.sermons where id = :'link_id'), 'and so is a new outside sermon');

-- Waiting entries are seen by their author and the Pastor, and nobody else.
select pg_temp.act_as(:member_a);
select pg_temp.check((select count(*) = 3 from public.sermon_feed(:'church_a')), 'the author sees their own waiting article alongside the Pastor''s sermons');
select pg_temp.check((select count(*) = 0 from public.sermon_feed(:'church_a') where id = :'link_id'), 'but not another member''s waiting link');
select pg_temp.check((select count(*) = 0 from public.sermon_detail(:'link_id')), 'nor its detail');
select pg_temp.check((select body like 'In the morning%' and author_name = 'Mary Member' and is_mine from public.sermon_detail(:'article_id')), 'the author can read their own article');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 2 from public.sermon_feed(:'church_a')), 'an elder sees neither waiting entry');
select pg_temp.check((select count(*) = 0 from public.sermon_detail(:'article_id')), 'and cannot open the waiting article');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.check((select count(*) = 5 from public.sermon_feed(:'church_a')), 'the Pastor sees everything, drafts and waiting entries included');
select pg_temp.check((select count(*) = 2 from public.sermon_feed(:'church_a') where status = 'pending'), 'including the two waiting for review');
reset role;

-- Only the Pastor reviews.
select pg_temp.act_as(:elder_a);
select pg_temp.fails(format('select public.review_sermon(%L, true, null)', :'article_id'), 'an elder cannot approve');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.review_sermon(%L, true, null)', :'article_id'), 'an author cannot approve their own article');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('select public.review_sermon(%L, true, null)', (select id from public.sermons where title = 'Grace in a few words')),
  'and the Pastor''s own sermons are not part of review');
select public.review_sermon(:'article_id', true, null);
select public.review_sermon(:'link_id', false, 'Please share a link to the original page, not a clip.');
reset role;

-- After approval every member sees the article, tagged and named.
select pg_temp.act_as(:pending_a);
select pg_temp.check((select count(*) = 0 from public.sermon_feed(:'church_a')), 'someone waiting for approval sees no sermons');
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 3 and count(*) filter (where source = 'member') = 1 from public.sermon_feed(:'church_a')),
  'once approved, the article reaches every member');
select pg_temp.check((select author_name = 'Mary Member' from public.sermon_feed(:'church_a') where id = :'article_id'), 'with its author''s name');
select pg_temp.check((select body like 'In the morning%' from public.sermon_detail(:'article_id')), 'and its full text');
reset role;

-- A declined entry stays with its author, with the Pastor's note.
select pg_temp.act_as(:member_a2);
select pg_temp.check((select status = 'declined' and review_note like 'Please share%' from public.sermon_detail(:'link_id')), 'the author sees that it was declined, and why');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.check((select count(*) = 0 from public.sermon_feed(:'church_a') where id = :'link_id'), 'and other members still do not see it');
reset role;

-- Editing sends an approved article back for review.
select pg_temp.act_as(:member_a2);
select pg_temp.fails(format('select public.edit_submission(%L, ''Hijacked'', '''', '''', null, null, null, null, ''Changed'', null)', :'article_id'),
  'a member cannot edit someone else''s article');
select public.edit_submission(:'link_id', 'A talk on forgiveness (original page)', 'Some Preacher', '', null, null, null, null,
  'Helped me forgive my brother.', 'https://example.org/forgiveness-original');
reset role;
select pg_temp.check((select status = 'pending' and review_note is null from public.sermons where id = :'link_id'), 'editing a declined link sends it back for review');
select pg_temp.act_as(:member_a);
select public.edit_submission(:'article_id', 'Why I pray in the morning', '', 'Psalm 5:3', 'Psalms', 5, 3, 3,
  'In the morning, Lord, you hear my voice. A longer and better version of this article.', null);
reset role;
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 0 from public.sermon_feed(:'church_a') where id = :'article_id'), 'an edited article disappears for members until it is approved again');
reset role;
select pg_temp.act_as(:pastor_a);
select pg_temp.fails(format('select public.edit_submission(%L, ''Pastor edit'', '''', '''', null, null, null, null, ''x'', null)', :'article_id'),
  'the Pastor cannot rewrite a member''s article, only approve or decline it');
select public.review_sermon(:'article_id', true, null);
reset role;

-- The Pastor adding an outside sermon publishes at once.
select pg_temp.act_as(:pastor_a);
select public.submit_sermon(:'church_a', 'external', 'A good sermon from elsewhere', 'Another Preacher', '', null, null, null, null, null,
  'https://example.net/sermon') as pastor_link \gset
reset role;
select pg_temp.check((select status = 'approved' from public.sermons where id = :'pastor_link'), 'an outside sermon added by the Pastor needs no review');

-- Limit on waiting entries: five at a time.
select pg_temp.act_as(:member_a2);
select public.submit_sermon(:'church_a', 'external', 'Extra 1', '', '', null, null, null, null, null, 'https://example.com/1');
select public.submit_sermon(:'church_a', 'external', 'Extra 2', '', '', null, null, null, null, null, 'https://example.com/2');
select public.submit_sermon(:'church_a', 'external', 'Extra 3', '', '', null, null, null, null, null, 'https://example.com/3');
select public.submit_sermon(:'church_a', 'external', 'Extra 4', '', '', null, null, null, null, null, 'https://example.com/4');
select pg_temp.fails(format('select public.submit_sermon(%L, ''external'', ''Extra 6'', '''', '''', null, null, null, null, null, ''https://example.com/6'')', :'church_a'),
  'a sixth waiting entry is refused');
reset role;

-- Removing.
select pg_temp.act_as(:member_a);
delete from public.sermons where id = :'link_id';
delete from public.sermons where source = 'pastor';
reset role;
select pg_temp.check((select count(*) = 4 from public.sermons where source = 'pastor' or id = :'link_id'),
  'a member can neither remove another member''s entry nor the Pastor''s sermons');
select pg_temp.act_as(:member_a2);
delete from public.sermons where id = :'link_id';
reset role;
select pg_temp.check((select count(*) = 0 from public.sermons where id = :'link_id'), 'an author can remove their own entry');
select pg_temp.act_as(:pastor_a);
delete from public.sermons where id = :'article_id';
reset role;
select pg_temp.check((select count(*) = 0 from public.sermons where id = :'article_id'), 'the Pastor can remove any entry');

-- Outsiders.
select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('select public.submit_sermon(%L, ''external'', ''Let me in'', '''', '''', null, null, null, null, null, ''https://example.com'')', :'church_a'),
  'someone waiting for approval cannot submit');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.check((select count(*) = 0 from public.sermon_feed(:'church_a')), 'another church''s Pastor sees none of these sermons');
select pg_temp.fails(format('select public.submit_sermon(%L, ''external'', ''Cross-church'', '''', '''', null, null, null, null, null, ''https://example.com'')', :'church_a'),
  'and cannot submit one here');
select pg_temp.fails(format('select public.review_sermon(%L, true, null)', :'pastor_link'), 'or review here');
reset role;

set role anon;
select pg_temp.fails('select * from public.sermons', 'signed-out visitors cannot read sermons');
select pg_temp.fails(format('select * from public.sermon_feed(%L)', :'church_a'), 'or the sermon list');
reset role;
