-- Who a transaction came from (or went to).
--
-- For money in, the Pastor or elder says who gave it: picked from the church's members, or typed for someone
-- outside the church. For money out it is who was paid. The name is always kept on the entry itself, so the
-- record still reads correctly after a member leaves or deletes their account; the link to the member is only
-- there to know who they were, and is cleared if they go.

alter table public.fund_transactions
  add column party_name text not null default '' check (char_length(party_name) <= 100),
  add column party_user_id uuid references public.profiles (id) on delete set null;

grant insert (party_name, party_user_id) on public.fund_transactions to authenticated;
grant update (party_name, party_user_id) on public.fund_transactions to authenticated;

-- A linked member has to be an approved member of the same church, so an entry cannot point at a stranger.
create function public.check_fund_party()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.party_user_id is not null and not exists (
    select 1 from public.memberships
    where church_id = new.church_id and user_id = new.party_user_id and status = 'approved'
  ) then
    raise exception 'That person is not a member of this church' using errcode = '23514';
  end if;
  -- A linked member always has a name on the entry.
  if new.party_user_id is not null and trim(new.party_name) = '' then
    raise exception 'Give the entry the member''s name' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger fund_transactions_party before insert or update on public.fund_transactions
  for each row execute function public.check_fund_party();
