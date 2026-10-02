-- Church funds: a ledger the Pastor and elders keep, so they can see the church's balance and recent transactions.
--
-- Nothing here connects to a bank. The Pastor and elders record the opening balance and each transaction by
-- hand; the balance is the opening balance plus every entry. Only the Pastor and elders of the church can see
-- or change any of it: not members, not church admins, not another church. No bank login, card number or full
-- account number is ever stored: the account label is a short note like "Federal Bank ••1234".
--
-- Every change to a transaction is also written to an append-only log (who, when, before and after), so there
-- is a trail if the figures are ever questioned. The "source" column says where an entry came from. It is
-- 'manual' for everything entered in the app, and leaves room for a bank feed to add 'bank' entries later.

create function public.can_manage_funds(p_church uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_church_role(p_church, array['pastor', 'elder']::public.member_role[]);
$$;

-- ---------------------------------------------------------------------------
-- The church's funds settings: one row per church
-- ---------------------------------------------------------------------------

create table public.church_funds (
  church_id uuid primary key references public.churches (id) on delete cascade,
  -- An ISO 4217 code such as INR, GBP or USD.
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  opening_balance numeric(14, 2) not null default 0,
  opening_date date not null default current_date,
  account_label text not null default '' check (char_length(account_label) <= 60),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------

create table public.fund_transactions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  occurred_on date not null,
  description text not null check (char_length(trim(description)) between 1 and 200),
  note text not null default '' check (char_length(note) <= 300),
  -- Money in is positive, money out is negative. Never zero.
  amount numeric(14, 2) not null check (amount <> 0),
  source text not null default 'manual' check (source in ('manual', 'bank')),
  -- Kept when someone leaves: the record outlives the person, only their name goes.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index fund_transactions_church_day_idx
  on public.fund_transactions (church_id, occurred_on desc, created_at desc);

-- ---------------------------------------------------------------------------
-- The log of every change to a transaction
-- ---------------------------------------------------------------------------

create table public.fund_log (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.churches (id) on delete cascade,
  transaction_id uuid not null,
  action text not null check (action in ('added', 'changed', 'deleted')),
  actor_id uuid references public.profiles (id) on delete set null,
  at timestamptz not null default now(),
  before jsonb,
  after jsonb
);

create index fund_log_church_idx on public.fund_log (church_id, at desc);

-- Fills in who changed what and when, so the app cannot claim to be someone else.
create function public.touch_funds_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger church_funds_touch before update on public.church_funds
  for each row execute function public.touch_funds_row();
create trigger fund_transactions_touch before update on public.fund_transactions
  for each row execute function public.touch_funds_row();

create function public.log_fund_transaction()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.fund_log (church_id, transaction_id, action, actor_id, before, after)
    values (new.church_id, new.id, 'added', auth.uid(), null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.fund_log (church_id, transaction_id, action, actor_id, before, after)
    values (new.church_id, new.id, 'changed', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  end if;

  -- When a whole church is deleted its entries go with it, and so does its log. Nothing to record then.
  if exists (select 1 from public.churches where id = old.church_id) then
    insert into public.fund_log (church_id, transaction_id, action, actor_id, before, after)
    values (old.church_id, old.id, 'deleted', auth.uid(), to_jsonb(old), null);
  end if;
  return old;
end;
$$;

create trigger fund_transactions_log after insert or update or delete on public.fund_transactions
  for each row execute function public.log_fund_transaction();

-- ---------------------------------------------------------------------------
-- Who can do what
-- ---------------------------------------------------------------------------

alter table public.church_funds enable row level security;
alter table public.fund_transactions enable row level security;
alter table public.fund_log enable row level security;
revoke all on public.church_funds, public.fund_transactions, public.fund_log from anon, authenticated;

grant select, insert on public.church_funds to authenticated;
grant update (currency, opening_balance, opening_date, account_label) on public.church_funds to authenticated;

grant select, delete on public.fund_transactions to authenticated;
grant insert (church_id, occurred_on, description, note, amount, created_by) on public.fund_transactions to authenticated;
grant update (occurred_on, description, note, amount) on public.fund_transactions to authenticated;

-- The log can only be read. It is written by the trigger above.
grant select on public.fund_log to authenticated;

create policy "church_funds: the Pastor and elders read"
  on public.church_funds for select to authenticated
  using (public.can_manage_funds(church_id));
create policy "church_funds: the Pastor and elders set up"
  on public.church_funds for insert to authenticated
  with check (public.can_manage_funds(church_id));
create policy "church_funds: the Pastor and elders change"
  on public.church_funds for update to authenticated
  using (public.can_manage_funds(church_id)) with check (public.can_manage_funds(church_id));

create policy "fund_transactions: the Pastor and elders read"
  on public.fund_transactions for select to authenticated
  using (public.can_manage_funds(church_id));
create policy "fund_transactions: the Pastor and elders add in their own name"
  on public.fund_transactions for insert to authenticated
  with check (public.can_manage_funds(church_id) and created_by = auth.uid());
create policy "fund_transactions: the Pastor and elders change"
  on public.fund_transactions for update to authenticated
  using (public.can_manage_funds(church_id)) with check (public.can_manage_funds(church_id));
create policy "fund_transactions: the Pastor and elders delete"
  on public.fund_transactions for delete to authenticated
  using (public.can_manage_funds(church_id));

create policy "fund_log: the Pastor and elders read"
  on public.fund_log for select to authenticated
  using (public.can_manage_funds(church_id));

-- ---------------------------------------------------------------------------
-- The balance
-- ---------------------------------------------------------------------------

-- Returns no row until the funds have been set up. The balance is worked out here, on the server, so it is
-- always the opening balance plus every entry.
create function public.church_funds_summary(p_church uuid)
returns table (
  currency text,
  account_label text,
  opening_balance numeric,
  opening_date date,
  balance numeric,
  transaction_count bigint,
  latest_on date
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_manage_funds(p_church) then
    raise exception 'Only the Pastor and elders can see the church funds' using errcode = '42501';
  end if;

  return query
  select
    f.currency,
    f.account_label,
    f.opening_balance,
    f.opening_date,
    f.opening_balance + coalesce((select sum(t.amount) from public.fund_transactions t where t.church_id = p_church), 0),
    (select count(*) from public.fund_transactions t where t.church_id = p_church),
    (select max(t.occurred_on) from public.fund_transactions t where t.church_id = p_church)
  from public.church_funds f
  where f.church_id = p_church;
end;
$$;

revoke all on function public.can_manage_funds(uuid) from public, anon;
revoke all on function public.church_funds_summary(uuid) from public, anon;
grant execute on function public.can_manage_funds(uuid) to authenticated;
grant execute on function public.church_funds_summary(uuid) to authenticated;
