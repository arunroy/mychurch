-- Fundraisers: leaders run them and see the names; members see only totals and their own pledge.

\set pastor_a '''aaaaaaaa-0000-0000-0011-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0011-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0011-000000000002'''
\set member_a '''aaaaaaaa-0000-0000-0011-000000000003'''
\set member_b '''aaaaaaaa-0000-0000-0011-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0011-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'fra@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'frb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'fre@example.com', '{"full_name": "Eli Elder"}'),
  (:member_a, 'frm@example.com', '{"full_name": "Mary Member"}'),
  (:member_b, 'frm2@example.com', '{"full_name": "Mark Member"}'),
  (:pending_a, 'frp@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Fundraiser Church A', 'Springfield', 'a@fr.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Fundraiser Church B', 'Shelbyville', 'b@fr.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :member_b, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Opening a fundraiser
select pg_temp.act_as(:elder_a);
insert into public.fundraisers (church_id, title, description, target_amount, currency, created_by)
  values (:'church_a', 'New building', 'A hall for the church', 1000000, 'INR', :elder_a) returning id as fr1 \gset
insert into public.fundraisers (church_id, title, created_by) values (:'church_a', 'Open-ended cause', :elder_a) returning id as fr2 \gset
select pg_temp.check(true, 'an elder opens fundraisers, with or without a target');
select pg_temp.fails(format('insert into public.fundraisers (church_id, title, target_amount, created_by) values (%L, ''x'', 0, %L)', :'church_a', :elder_a), 'a target must be above zero');
select pg_temp.fails(format('insert into public.fundraisers (church_id, title, created_by) values (%L, '' '', %L)', :'church_a', :elder_a), 'a fundraiser needs a title');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.fails(format('insert into public.fundraisers (church_id, title, created_by) values (%L, ''Mine'', %L)', :'church_a', :member_a), 'a member cannot open a fundraiser');
select pg_temp.check(pg_temp.count_of('select * from public.fundraisers') = 2, 'but can see them');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.fundraisers') = 0, 'another church sees none');
select pg_temp.fails(format('insert into public.fundraisers (church_id, title, created_by) values (%L, ''Sneaky'', %L)', :'church_a', :pastor_b), 'and cannot open one here');
reset role;

-- Recording money received
select pg_temp.act_as(:elder_a);
insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, party_name, party_user_id, created_by)
  values (:'fr1', :'church_a', 'received', 25000, 'Mary Member', :member_a, :elder_a);
insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, party_name, created_by)
  values (:'fr1', :'church_a', 'received', 5000, 'A friend of the church', :elder_a);
select pg_temp.check(true, 'an elder records money from a member or from someone outside the church');
select pg_temp.fails(format('insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, party_name, party_user_id, created_by) values (%L, %L, ''received'', 10, ''Pat Pending'', %L, %L)', :'fr1', :'church_a', :pending_a, :elder_a), 'a named member has to be an approved member');
select pg_temp.fails(format('insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, created_by) values (%L, %L, ''received'', -5, %L)', :'fr1', :'church_a', :elder_a), 'an amount must be above zero');
select pg_temp.fails(format('insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, party_name, party_user_id, created_by) values (%L, %L, ''pledge'', 10, ''Eli Elder'', %L, %L)', :'fr1', :'church_a', :elder_a, :elder_a), 'a leader cannot add a pledge for someone');
select pg_temp.fails(format('insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, created_by) values (%L, %L, ''received'', 10, %L)', :'fr1', :'church_b', :elder_a), 'an entry cannot point at another church');
reset role;

-- Members pledge
select pg_temp.act_as(:member_a);
select public.set_my_pledge(:'fr1', 10000);
select public.set_my_pledge(:'fr1', 12000);
reset role;
select pg_temp.act_as(:member_b);
select public.set_my_pledge(:'fr1', 3000);
reset role;
select pg_temp.check((select count(*) = 1 from public.fundraiser_entries where kind = 'pledge' and party_user_id = :member_a and amount = 12000), 'a member has one pledge and changing it replaces it');

select pg_temp.act_as(:pending_a);
select pg_temp.fails(format('select public.set_my_pledge(%L, 100)', :'fr1'), 'someone waiting for approval cannot pledge');
reset role;
select pg_temp.act_as(:pastor_b);
select pg_temp.fails(format('select public.set_my_pledge(%L, 100)', :'fr1'), 'nor can another church');
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.set_my_pledge(%L, -5)', :'fr1'), 'a pledge cannot be negative');
reset role;

-- What members see: totals, not names
select pg_temp.act_as(:member_a);
select pg_temp.check((select received_total = 30000 and pledged_total = 15000 and my_pledge = 12000 and target_amount = 1000000 from public.fundraiser_summaries(:'church_a') where id = :'fr1'), 'a member sees what was received, what is pledged and their own pledge');
select pg_temp.check((select received_total = 0 and pledged_total = 0 and my_pledge is null and target_amount is null from public.fundraiser_summaries(:'church_a') where id = :'fr2'), 'and a fundraiser without a target or money shows zeros');
select pg_temp.check(pg_temp.count_of('select * from public.fundraiser_entries') = 0, 'a member cannot read the entries, which hold the names');
select pg_temp.fails(format('insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, party_name, created_by) values (%L, %L, ''received'', 99, ''Me'', %L)', :'fr1', :'church_a', :member_a), 'a member cannot record money received');
select pg_temp.fails(format('insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, party_name, party_user_id, created_by) values (%L, %L, ''pledge'', 1, ''Mary Member'', %L, %L)', :'fr2', :'church_a', :member_a, :member_a), 'or insert a pledge directly');
update public.fundraisers set status = 'closed' where id = :'fr1';
reset role;
select pg_temp.check((select status = 'active' from public.fundraisers where id = :'fr1'), 'or close a fundraiser');
select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of(format('select * from public.fundraiser_summaries(%L)', :'church_a')) = 0, 'another church gets no totals');
reset role;
set role anon;
select pg_temp.fails(format('select * from public.fundraiser_summaries(%L)', :'church_a'), 'signed-out visitors get nothing');
reset role;

-- What leaders see: the names
select pg_temp.act_as(:elder_a);
select pg_temp.check((select count(*) = 4 from public.fundraiser_entries where fundraiser_id = :'fr1'), 'an elder sees every entry');
select pg_temp.check((select bool_and(party_name <> '') from public.fundraiser_entries), 'with the names');
select pg_temp.check((select count(*) = 2 from public.fundraiser_entries where kind = 'pledge'), 'including who pledged');
update public.fundraiser_entries set amount = 26000 where kind = 'received' and party_user_id = :member_a;
select pg_temp.check((select received_total = 31000 from public.fundraiser_summaries(:'church_a') where id = :'fr1'), 'an elder can correct an amount received, and the total follows');
update public.fundraiser_entries set amount = 1 where kind = 'pledge' and party_user_id = :member_a;
select pg_temp.check((select amount = 12000 from public.fundraiser_entries where kind = 'pledge' and party_user_id = :member_a), 'but cannot change someone else''s pledge');
delete from public.fundraiser_entries where kind = 'pledge' and party_user_id = :member_b;
select pg_temp.check((select pledged_total = 12000 from public.fundraiser_summaries(:'church_a') where id = :'fr1'), 'a leader can remove a pledge');
reset role;

-- Closing
select pg_temp.act_as(:elder_a);
update public.fundraisers set status = 'closed' where id = :'fr1';
reset role;
select pg_temp.act_as(:member_a);
select pg_temp.fails(format('select public.set_my_pledge(%L, 500)', :'fr1'), 'nobody can pledge to a closed fundraiser');
select pg_temp.check((select id = :'fr2' from public.fundraiser_summaries(:'church_a') limit 1), 'open fundraisers are listed before closed ones');
reset role;

-- A pledge can be taken back
select pg_temp.act_as(:member_a);
select public.set_my_pledge(:'fr2', 700);
select public.set_my_pledge(:'fr2', 0);
reset role;
select pg_temp.check((select count(*) = 0 from public.fundraiser_entries where fundraiser_id = :'fr2'), 'a zero takes the pledge back');

-- Deleting
select pg_temp.act_as(:elder_a);
delete from public.fundraisers where id = :'fr1';
reset role;
select pg_temp.check((select count(*) = 0 from public.fundraiser_entries where fundraiser_id = :'fr1'), 'deleting a fundraiser deletes its entries');

-- A person who leaves keeps their gift on the record, but loses the link
delete from auth.users where id = :member_a;
select pg_temp.check(true, 'deleting an account does not break the fundraisers');
