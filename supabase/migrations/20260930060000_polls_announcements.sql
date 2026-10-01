-- Polls and announcements.
--
-- Announcements: the Pastor, elders and church admins (the leaders) post short notices that
-- every approved member sees on their Home screen until they expire or are removed.
--
-- Polls: any approved member can ask the church a question. Votes are private: the tables
-- below are closed to direct access and everything goes through the functions, which only ever
-- show totals. Someone sees the results once they have voted, or once the poll has closed.

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  body text not null default '' check (char_length(body) <= 2000),
  -- Null means it stays until a leader removes it.
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index announcements_church_created_idx on public.announcements (church_id, created_at desc);

alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant select, insert, delete on public.announcements to authenticated;

create policy "announcements: members read the ones still showing"
  on public.announcements for select to authenticated
  using (public.is_church_member(church_id) and (expires_at is null or expires_at > now()));

create policy "announcements: leaders read everything, including expired"
  on public.announcements for select to authenticated
  using (public.is_church_leader(church_id));

create policy "announcements: leaders post in their own name"
  on public.announcements for insert to authenticated
  with check (author_id = auth.uid() and public.is_church_leader(church_id));

create policy "announcements: leaders remove"
  on public.announcements for delete to authenticated
  using (public.is_church_leader(church_id));

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 200),
  multiple boolean not null default false,
  closes_at timestamptz,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);

create index polls_church_created_idx on public.polls (church_id, created_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  position integer not null
);

create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  option_id uuid not null references public.poll_options (id) on delete cascade,
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, user_id)
);

create index poll_votes_poll_user_idx on public.poll_votes (poll_id, user_id);

-- No policies and no grants: nobody touches these tables directly, so nobody can read who voted.
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.polls, public.poll_options, public.poll_votes from anon, authenticated;

-- Any approved member starts a poll.
create function public.create_poll(
  p_church uuid,
  p_question text,
  p_options text[],
  p_multiple boolean default false,
  p_closes_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_labels text[];
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.is_church_member(p_church) then
    raise exception 'Only members of this church can start a poll' using errcode = '42501';
  end if;

  select coalesce(array_agg(trim(o) order by ord), '{}') into v_labels
  from unnest(p_options) with ordinality as t(o, ord)
  where trim(o) <> '';

  if cardinality(v_labels) < 2 or cardinality(v_labels) > 10 then
    raise exception 'A poll needs between 2 and 10 choices';
  end if;
  if (select count(distinct lower(l)) from unnest(v_labels) l) <> cardinality(v_labels) then
    raise exception 'Each choice needs to be different';
  end if;
  if exists (select 1 from unnest(v_labels) l where char_length(l) > 100) then
    raise exception 'Keep each choice under 100 characters';
  end if;
  if char_length(trim(coalesce(p_question, ''))) not between 1 and 200 then
    raise exception 'Ask a question of up to 200 characters';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'The closing time must be in the future';
  end if;

  insert into public.polls (church_id, creator_id, question, multiple, closes_at)
  values (p_church, auth.uid(), trim(p_question), coalesce(p_multiple, false), p_closes_at)
  returning id into v_id;

  insert into public.poll_options (poll_id, label, position)
  select v_id, l, ord from unnest(v_labels) with ordinality as t(l, ord);

  return v_id;
end;
$$;

-- Votes (or changes a vote) while the poll is open. Replaces whatever the caller chose before.
create function public.cast_vote(p_poll uuid, p_options uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_poll public.polls;
  v_wanted uuid[];
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  select * into v_poll from public.polls where id = p_poll;
  if not found or not public.is_church_member(v_poll.church_id) then
    raise exception 'This poll isn''t available' using errcode = '42501';
  end if;
  if v_poll.closed or (v_poll.closes_at is not null and v_poll.closes_at <= now()) then
    raise exception 'This poll has closed';
  end if;

  select coalesce(array_agg(distinct o), '{}') into v_wanted from unnest(p_options) o;
  if cardinality(v_wanted) = 0 then
    raise exception 'Choose an answer';
  end if;
  if not v_poll.multiple and cardinality(v_wanted) > 1 then
    raise exception 'Choose just one answer';
  end if;
  if (select count(*) from public.poll_options where poll_id = p_poll and id = any (v_wanted)) <> cardinality(v_wanted) then
    raise exception 'That isn''t one of the choices';
  end if;

  delete from public.poll_votes where poll_id = p_poll and user_id = auth.uid();
  insert into public.poll_votes (option_id, poll_id, user_id)
  select o, p_poll, auth.uid() from unnest(v_wanted) o;
end;
$$;

-- The person who asked, or a leader, can end a poll early.
create function public.close_poll(p_poll uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_poll public.polls;
begin
  select * into v_poll from public.polls where id = p_poll;
  if not found
     or not (v_poll.creator_id = auth.uid() or public.is_church_leader(v_poll.church_id))
     or not public.is_church_member(v_poll.church_id) then
    raise exception 'You can''t close this poll' using errcode = '42501';
  end if;
  update public.polls set closed = true where id = p_poll;
end;
$$;

create function public.delete_poll(p_poll uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_poll public.polls;
begin
  select * into v_poll from public.polls where id = p_poll;
  if not found
     or not (v_poll.creator_id = auth.uid() or public.is_church_leader(v_poll.church_id))
     or not public.is_church_member(v_poll.church_id) then
    raise exception 'You can''t remove this poll' using errcode = '42501';
  end if;
  delete from public.polls where id = p_poll;
end;
$$;

-- The church's polls, open ones first. Totals stay hidden (null) until the caller has voted or the
-- poll has closed, so early results don't sway people.
create function public.church_polls(p_church uuid)
returns table (
  id uuid,
  creator_id uuid,
  creator_name text,
  question text,
  multiple boolean,
  closes_at timestamptz,
  is_closed boolean,
  created_at timestamptz,
  total_voters integer,
  my_option_ids uuid[],
  options jsonb
)
language sql stable security definer set search_path = ''
as $$
  with mine as (
    select v.poll_id, array_agg(v.option_id) as ids
    from public.poll_votes v
    where v.user_id = auth.uid()
    group by v.poll_id
  )
  select p.id,
         p.creator_id,
         pr.full_name,
         p.question,
         p.multiple,
         p.closes_at,
         c.is_closed,
         p.created_at,
         case when c.is_closed or m.ids is not null
              then (select count(distinct v.user_id)::integer from public.poll_votes v where v.poll_id = p.id)
         end,
         coalesce(m.ids, '{}'::uuid[]),
         (select jsonb_agg(
                   jsonb_build_object(
                     'id', o.id,
                     'label', o.label,
                     'votes', case when c.is_closed or m.ids is not null
                                   then (select count(*) from public.poll_votes v where v.option_id = o.id)
                              end
                   )
                   order by o.position)
            from public.poll_options o where o.poll_id = p.id)
  from public.polls p
  join public.profiles pr on pr.id = p.creator_id
  left join mine m on m.poll_id = p.id
  cross join lateral (
    select (p.closed or (p.closes_at is not null and p.closes_at <= now())) as is_closed
  ) c
  where p.church_id = p_church
    and public.is_church_member(p_church)
  order by c.is_closed, p.created_at desc
  limit 50;
$$;

revoke execute on function
  public.create_poll(uuid, text, text[], boolean, timestamptz),
  public.cast_vote(uuid, uuid[]),
  public.close_poll(uuid),
  public.delete_poll(uuid),
  public.church_polls(uuid)
from public, anon;

grant execute on function
  public.create_poll(uuid, text, text[], boolean, timestamptz),
  public.cast_vote(uuid, uuid[]),
  public.close_poll(uuid),
  public.delete_poll(uuid),
  public.church_polls(uuid)
to authenticated;
