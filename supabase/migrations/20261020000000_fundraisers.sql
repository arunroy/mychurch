-- Fundraisers: the Pastor and elders open a fundraiser for a cause (a new building, a mission trip), optionally with a
-- target. They record the money that comes in. Members say how much they can give (a pledge) and see how far the
-- fundraiser has got, but never who gave or pledged what: only the Pastor and elders can see the names.
--
-- Members read the totals through fundraiser_summaries and write their own pledge through set_my_pledge. They have no
-- access to the entries table, which holds the names. This is separate from the church's funds ledger.

create table public.fundraisers (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  -- Optional: without a target there is no bar, only the total raised.
  target_amount numeric(14, 2) check (target_amount > 0),
  -- An ISO 4217 code such as INR or GBP.
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, church_id)
);

create index fundraisers_church_idx on public.fundraisers (church_id, status, created_at desc);

-- Money received (entered by the Pastor and elders) and pledges (entered by the member).
create table public.fundraiser_entries (
  id uuid primary key default gen_random_uuid(),
  fundraiser_id uuid not null,
  church_id uuid not null,
  kind text not null check (kind in ('received', 'pledge')),
  amount numeric(14, 2) not null check (amount > 0),
  -- Always kept on the entry, so it still reads correctly after a member leaves. Linked to a member when one was picked.
  party_name text not null default '' check (char_length(party_name) <= 100),
  party_user_id uuid references public.profiles (id) on delete set null,
  occurred_on date not null default current_date,
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (fundraiser_id, church_id) references public.fundraisers (id, church_id) on delete cascade
);

create index fundraiser_entries_fundraiser_idx on public.fundraiser_entries (fundraiser_id, occurred_on desc, created_at desc);
-- A member has one pledge per fundraiser, which they can change.
create unique index fundraiser_entries_one_pledge_idx
  on public.fundraiser_entries (fundraiser_id, party_user_id) where kind = 'pledge';

-- A linked member has to be an approved member of the same church, and has a name on the entry.
create trigger fundraiser_entries_party before insert or update on public.fundraiser_entries
  for each row execute function public.check_fund_party();

-- ---------------------------------------------------------------------------
-- Who can do what
-- ---------------------------------------------------------------------------

alter table public.fundraisers enable row level security;
alter table public.fundraiser_entries enable row level security;
revoke all on public.fundraisers, public.fundraiser_entries from anon, authenticated;

grant select, delete on public.fundraisers to authenticated;
grant insert (church_id, title, description, target_amount, currency, created_by) on public.fundraisers to authenticated;
grant update (title, description, target_amount, currency, status) on public.fundraisers to authenticated;

create policy "fundraisers: members read"
  on public.fundraisers for select to authenticated
  using (public.is_church_member(church_id));
create policy "fundraisers: the Pastor and elders add in their own name"
  on public.fundraisers for insert to authenticated
  with check (public.can_manage_funds(church_id) and created_by = auth.uid());
create policy "fundraisers: the Pastor and elders change"
  on public.fundraisers for update to authenticated
  using (public.can_manage_funds(church_id)) with check (public.can_manage_funds(church_id));
create policy "fundraisers: the Pastor and elders delete"
  on public.fundraisers for delete to authenticated
  using (public.can_manage_funds(church_id));

-- The entries carry names, so only the Pastor and elders can read them. They add and change money received;
-- pledges only ever come from the member (set_my_pledge), though a leader can remove one.
grant select, delete on public.fundraiser_entries to authenticated;
grant insert (fundraiser_id, church_id, kind, amount, party_name, party_user_id, occurred_on, note, created_by)
  on public.fundraiser_entries to authenticated;
grant update (amount, party_name, party_user_id, occurred_on, note) on public.fundraiser_entries to authenticated;

create policy "fundraiser_entries: the Pastor and elders read"
  on public.fundraiser_entries for select to authenticated
  using (public.can_manage_funds(church_id));
create policy "fundraiser_entries: the Pastor and elders record money received"
  on public.fundraiser_entries for insert to authenticated
  with check (public.can_manage_funds(church_id) and kind = 'received' and created_by = auth.uid());
create policy "fundraiser_entries: the Pastor and elders change money received"
  on public.fundraiser_entries for update to authenticated
  using (public.can_manage_funds(church_id) and kind = 'received')
  with check (public.can_manage_funds(church_id) and kind = 'received');
create policy "fundraiser_entries: the Pastor and elders delete"
  on public.fundraiser_entries for delete to authenticated
  using (public.can_manage_funds(church_id));

-- ---------------------------------------------------------------------------
-- What members see: totals only
-- ---------------------------------------------------------------------------

-- Every fundraiser of the church with what has been received and pledged, and the caller's own pledge. No names.
create function public.fundraiser_summaries(p_church uuid)
returns table (
  id uuid,
  title text,
  description text,
  target_amount numeric,
  currency text,
  status text,
  created_at timestamptz,
  received_total numeric,
  pledged_total numeric,
  my_pledge numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_church_member(p_church) then
    return;
  end if;
  return query
  select
    f.id, f.title, f.description, f.target_amount, f.currency, f.status, f.created_at,
    coalesce(sum(e.amount) filter (where e.kind = 'received'), 0),
    coalesce(sum(e.amount) filter (where e.kind = 'pledge'), 0),
    sum(e.amount) filter (where e.kind = 'pledge' and e.party_user_id = auth.uid())
  from public.fundraisers f
  left join public.fundraiser_entries e on e.fundraiser_id = f.id
  where f.church_id = p_church
  group by f.id
  order by (f.status = 'active') desc, f.created_at desc;
end;
$$;

-- A member says how much they can give. A new amount replaces the old one; zero or nothing takes the pledge back.
create function public.set_my_pledge(p_fundraiser uuid, p_amount numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
  v_status text;
  v_name text;
begin
  select f.church_id, f.status into v_church, v_status from public.fundraisers f where f.id = p_fundraiser;
  if v_church is null or auth.uid() is null or not public.is_church_member(v_church) then
    raise exception 'Only members of this church can pledge' using errcode = '42501';
  end if;
  if v_status <> 'active' then
    raise exception 'This fundraiser has closed';
  end if;

  if p_amount is null or p_amount = 0 then
    delete from public.fundraiser_entries where fundraiser_id = p_fundraiser and kind = 'pledge' and party_user_id = auth.uid();
    return;
  end if;
  if p_amount < 0 or p_amount >= 1000000000000 then
    raise exception 'That is not a sensible amount';
  end if;

  select p.full_name into v_name from public.profiles p where p.id = auth.uid();
  insert into public.fundraiser_entries (fundraiser_id, church_id, kind, amount, party_name, party_user_id, created_by)
  values (p_fundraiser, v_church, 'pledge', round(p_amount, 2), coalesce(nullif(trim(v_name), ''), 'Member'), auth.uid(), auth.uid())
  on conflict (fundraiser_id, party_user_id) where kind = 'pledge'
  do update set amount = excluded.amount, occurred_on = current_date, party_name = excluded.party_name;
end;
$$;

revoke all on function public.fundraiser_summaries(uuid), public.set_my_pledge(uuid, numeric) from public, anon;
grant execute on function public.fundraiser_summaries(uuid), public.set_my_pledge(uuid, numeric) to authenticated;
