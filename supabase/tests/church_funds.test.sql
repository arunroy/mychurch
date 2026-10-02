-- Church funds: only the Pastor and elders can see or change them. Everyone else, and every other church, sees nothing.

\set pastor_a '''aaaaaaaa-0000-0000-0008-000000000001'''
\set pastor_b '''bbbbbbbb-0000-0000-0008-000000000001'''
\set elder_a '''aaaaaaaa-0000-0000-0008-000000000002'''
\set admin_a '''aaaaaaaa-0000-0000-0008-000000000003'''
\set member_a '''aaaaaaaa-0000-0000-0008-000000000004'''
\set pending_a '''aaaaaaaa-0000-0000-0008-000000000005'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:pastor_a, 'fda@example.com', '{"full_name": "Pastor Anna"}'),
  (:pastor_b, 'fdb@example.com', '{"full_name": "Pastor Ben"}'),
  (:elder_a, 'fde@example.com', '{"full_name": "Eli Elder"}'),
  (:admin_a, 'fdd@example.com', '{"full_name": "Ada Admin"}'),
  (:member_a, 'fdm@example.com', '{"full_name": "Mary Member"}'),
  (:pending_a, 'fdp@example.com', '{"full_name": "Pat Pending"}');

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
select public.register_church('Funds Church A', 'Springfield', 'a@funds.example') as church_a \gset
select pg_temp.act_as(:pastor_b);
select public.register_church('Funds Church B', 'Shelbyville', 'b@funds.example') as church_b \gset
reset role;
update public.churches set status = 'active';
insert into public.memberships (church_id, user_id, role, status) values
  (:'church_a', :elder_a, 'elder', 'approved'),
  (:'church_a', :admin_a, 'admin', 'approved'),
  (:'church_a', :member_a, 'member', 'approved'),
  (:'church_a', :pending_a, 'member', 'pending');

-- Before setup there is no summary row.
select pg_temp.act_as(:pastor_a);
select pg_temp.check(pg_temp.count_of(format('select * from public.church_funds_summary(%L)', :'church_a')) = 0, 'no summary until the funds are set up');

-- Setting up: the Pastor
insert into public.church_funds (church_id, currency, opening_balance, opening_date, account_label)
  values (:'church_a', 'INR', 100000.50, '2026-01-01', 'Federal Bank ••1234');
select pg_temp.fails(format('insert into public.church_funds (church_id, currency) values (%L, ''rupee'')', :'church_b'), 'a currency must be a three-letter code (and not another church''s funds)');
reset role;

-- An elder records entries
select pg_temp.act_as(:elder_a);
insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by)
  values (:'church_a', '2026-02-01', 'Sunday offering', 25000.00, :elder_a);
insert into public.fund_transactions (church_id, occurred_on, description, note, amount, created_by)
  values (:'church_a', '2026-02-03', 'Electricity bill', 'January', -4200.25, :elder_a);
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by) values (%L, ''2026-02-04'', ''Nothing'', 0, %L)', :'church_a', :elder_a),
  'an amount cannot be zero');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by) values (%L, ''2026-02-04'', ''   '', 5, %L)', :'church_a', :elder_a),
  'a transaction needs a description');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by) values (%L, ''2026-02-04'', ''As someone else'', 5, %L)', :'church_a', :pastor_a),
  'an entry cannot be added in someone else''s name');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by, source) values (%L, ''2026-02-04'', ''Fake bank row'', 5, %L, ''bank'')', :'church_a', :elder_a),
  'the app cannot add entries that claim to come from a bank');
select pg_temp.check((select balance = 100000.50 + 25000.00 - 4200.25 from public.church_funds_summary(:'church_a')), 'the balance is the opening balance plus every entry');
select pg_temp.check((select transaction_count = 2 and latest_on = '2026-02-03' and currency = 'INR' and account_label = 'Federal Bank ••1234' from public.church_funds_summary(:'church_a')),
  'the summary has the count, the latest day, the currency and the account label');
update public.fund_transactions set amount = -4300.25 where description = 'Electricity bill';
select pg_temp.check((select balance = 100000.50 + 25000.00 - 4300.25 from public.church_funds_summary(:'church_a')), 'a changed entry changes the balance');
select pg_temp.fails('update public.fund_transactions set church_id = church_id where description = ''Electricity bill''', 'an entry cannot be moved to another church');
select pg_temp.check((select updated_by = :elder_a from public.fund_transactions where description = 'Electricity bill'), 'the database records who changed an entry');
reset role;

-- The log
select pg_temp.check((select count(*) = 3 from public.fund_log where church_id = :'church_a'), 'two entries added and one change are in the log');
select pg_temp.check((select (before ->> 'amount')::numeric = -4200.25 and (after ->> 'amount')::numeric = -4300.25 from public.fund_log where action = 'changed'), 'a change keeps the before and after');
select pg_temp.act_as(:pastor_a);
select pg_temp.check(pg_temp.count_of('select * from public.fund_log') = 3, 'the Pastor can read the log');
select pg_temp.fails(format('insert into public.fund_log (church_id, transaction_id, action) values (%L, gen_random_uuid(), ''added'')', :'church_a'), 'nobody can write the log by hand');
select pg_temp.fails('update public.fund_log set action = ''added''', 'nobody can change the log');
select pg_temp.fails('delete from public.fund_log', 'nobody can delete from the log');
delete from public.fund_transactions where description = 'Sunday offering';
reset role;
select pg_temp.check((select count(*) = 1 from public.fund_log where action = 'deleted'), 'a deleted entry is logged');
select pg_temp.check((select balance = 100000.50 - 4300.25 from public.church_funds_summary(:'church_a')), 'a deleted entry leaves the balance');

-- Nobody else sees any of it
select pg_temp.act_as(:admin_a);
select pg_temp.check(pg_temp.count_of('select * from public.fund_transactions') = 0, 'a church admin cannot read the transactions');
select pg_temp.check(pg_temp.count_of('select * from public.church_funds') = 0, 'or the settings');
select pg_temp.check(pg_temp.count_of('select * from public.fund_log') = 0, 'or the log');
select pg_temp.fails(format('select * from public.church_funds_summary(%L)', :'church_a'), 'or the summary');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by) values (%L, ''2026-02-05'', ''Admin entry'', 5, %L)', :'church_a', :admin_a), 'or add an entry');
reset role;

select pg_temp.act_as(:member_a);
select pg_temp.check(pg_temp.count_of('select * from public.fund_transactions') = 0, 'a member cannot read the transactions');
select pg_temp.fails(format('select * from public.church_funds_summary(%L)', :'church_a'), 'or the summary');
delete from public.fund_transactions;
update public.church_funds set opening_balance = 0;
reset role;
select pg_temp.check((select count(*) = 1 from public.fund_transactions), 'a member cannot delete entries');
select pg_temp.check((select opening_balance = 100000.50 from public.church_funds where church_id = :'church_a'), 'or change the opening balance');

select pg_temp.act_as(:pending_a);
select pg_temp.check(pg_temp.count_of('select * from public.fund_transactions') = 0, 'someone waiting for approval sees nothing');
reset role;

select pg_temp.act_as(:pastor_b);
select pg_temp.check(pg_temp.count_of('select * from public.fund_transactions') = 0, 'another church''s Pastor sees nothing');
select pg_temp.fails(format('select * from public.church_funds_summary(%L)', :'church_a'), 'and cannot ask for this church''s balance');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by) values (%L, ''2026-02-05'', ''Other church'', 5, %L)', :'church_a', :pastor_b), 'or add to it');
delete from public.fund_transactions;
reset role;
select pg_temp.check((select count(*) = 1 from public.fund_transactions), 'or delete from it');

set role anon;
select pg_temp.fails('select * from public.fund_transactions', 'signed-out visitors cannot read the transactions');
select pg_temp.fails('select * from public.church_funds', 'or the settings');
reset role;

-- Who the money came from
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0008-000000000009', 'fdg@example.com', '{"full_name": "Gina Giver"}');
insert into public.memberships (church_id, user_id, role, status) values (:'church_a', 'aaaaaaaa-0000-0000-0008-000000000009', 'member', 'approved');

select pg_temp.act_as(:elder_a);
insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by, party_name, party_user_id)
  values (:'church_a', '2026-03-01', 'Tithe', 5000, :elder_a, 'Gina Giver', 'aaaaaaaa-0000-0000-0008-000000000009');
insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by, party_name)
  values (:'church_a', '2026-03-02', 'Hall hire', 1500, :elder_a, 'Mr Thomas (visitor)');
select pg_temp.check((select count(*) = 2 from public.fund_transactions where party_name <> ''), 'an entry can name a member or someone outside the church');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by, party_name, party_user_id) values (%L, ''2026-03-03'', ''X'', 10, %L, ''Pat Pending'', %L)', :'church_a', :elder_a, :pending_a),
  'a member who is still waiting for approval cannot be linked');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by, party_name, party_user_id) values (%L, ''2026-03-03'', ''X'', 10, %L, ''Pastor Ben'', %L)', :'church_a', :elder_a, :pastor_b),
  'nor someone from another church');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by, party_user_id) values (%L, ''2026-03-03'', ''X'', 10, %L, %L)', :'church_a', :elder_a, :member_a),
  'a linked member needs a name on the entry');
select pg_temp.fails(format('insert into public.fund_transactions (church_id, occurred_on, description, amount, created_by, party_name) values (%L, ''2026-03-03'', ''X'', 10, %L, %L)', :'church_a', :elder_a, repeat('a', 101)),
  'a name has a limit');
update public.fund_transactions set party_name = 'Mr Tom Thomas' where description = 'Hall hire';
select pg_temp.check((select party_name = 'Mr Tom Thomas' from public.fund_transactions where description = 'Hall hire'), 'the name can be corrected afterwards');
reset role;

-- When a member leaves, their name stays on the entry and only the link goes.
delete from auth.users where id = 'aaaaaaaa-0000-0000-0008-000000000009';
select pg_temp.check((select party_user_id is null and party_name = 'Gina Giver' from public.fund_transactions where description = 'Tithe'), 'an entry keeps the name of a member who has left');

-- Deleting a church takes its funds and log with it, without errors from the log trigger.
delete from public.churches where id = :'church_a';
select pg_temp.check((select count(*) = 0 from public.fund_transactions) and (select count(*) = 0 from public.fund_log), 'deleting a church removes its funds and log');
