-- Chat groups: committees and fellowships (Food committee, Sisters fellowship, ...) next to the church chat.
--
-- The church chat stays exactly as it was and is now called General in the app: its messages keep group_id
-- null. A group is private to the people the Pastor or an elder put in it. The Pastor and elders create groups,
-- rename them, choose who is in them and delete them, but they read a group only when they are a member of it.
-- Managing a group never shows its messages.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index chat_groups_name_idx on public.chat_groups (church_id, lower(trim(name)));

create table public.chat_group_members (
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index chat_group_members_user_idx on public.chat_group_members (user_id);

-- How far each person has read each group. Only that person, only through the functions below.
create table public.chat_group_reads (
  group_id uuid not null references public.chat_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- No policies and no grants: all access goes through the functions, so nobody can list who is in a group
-- they are not part of.
alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_reads enable row level security;
revoke all on public.chat_groups, public.chat_group_members, public.chat_group_reads from anon, authenticated;

-- Which chat a message belongs to. Null is the church-wide chat (General).
alter table public.church_chat_messages
  add column group_id uuid references public.chat_groups (id) on delete cascade;

create index church_chat_messages_group_created_idx
  on public.church_chat_messages (group_id, created_at desc) where group_id is not null;

-- ---------------------------------------------------------------------------
-- Who is who
-- ---------------------------------------------------------------------------

-- In the group, the group is this church's, and the person is still an approved member of the church, so
-- someone removed from the church loses every group at once.
create function public.is_chat_group_member(p_group uuid, p_church uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_group_members gm
    join public.chat_groups g on g.id = gm.group_id and g.church_id = p_church
    join public.memberships ms on ms.church_id = g.church_id and ms.user_id = gm.user_id and ms.status = 'approved'
    where gm.group_id = p_group and gm.user_id = auth.uid()
  );
$$;

create function public.can_manage_chat_groups(p_church uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_church_role(p_church, array['pastor', 'elder']::public.member_role[]);
$$;

-- ---------------------------------------------------------------------------
-- Messages: General for every member, a group for its members
-- ---------------------------------------------------------------------------

drop policy "church chat: members read" on public.church_chat_messages;
drop policy "church chat: members post in their own name" on public.church_chat_messages;
drop policy "church chat: authors and leaders remove" on public.church_chat_messages;

create policy "church chat: members read"
  on public.church_chat_messages for select to authenticated
  using (
    public.is_church_member(church_id)
    and (group_id is null or public.is_chat_group_member(group_id, church_id))
  );

create policy "church chat: members post in their own name"
  on public.church_chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_church_member(church_id)
    and (group_id is null or public.is_chat_group_member(group_id, church_id))
  );

-- The author can remove their own message. In General any leader can too. In a group only the Pastor or an
-- elder who is in that group can, since they are the only leaders who can read it.
create policy "church chat: authors and moderators remove"
  on public.church_chat_messages for delete to authenticated
  using (
    public.is_church_member(church_id)
    and (
      sender_id = auth.uid()
      or (group_id is null and public.is_church_leader(church_id))
      or (group_id is not null and public.can_manage_chat_groups(church_id) and public.is_chat_group_member(group_id, church_id))
    )
  );

-- The latest messages of General (no group) or of one group, with each sender's name and photo.
drop function public.church_chat_feed(uuid, integer);

create function public.church_chat_feed(p_church uuid, p_limit integer default 100, p_group uuid default null)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  sender_avatar_path text,
  body text,
  created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.sender_id, p.full_name, p.avatar_path, m.body, m.created_at
  from public.church_chat_messages m
  join public.profiles p on p.id = m.sender_id
  where m.church_id = p_church
    and public.is_church_member(p_church)
    and (
      (p_group is null and m.group_id is null)
      or (p_group is not null and m.group_id = p_group and public.is_chat_group_member(p_group, p_church))
    )
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- Unread
-- ---------------------------------------------------------------------------

-- General's unread count must not include group messages, which most members are not allowed to read.
create or replace function public.church_chat_unread_count(p_church uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer
  from public.church_chat_messages m
  where m.church_id = p_church
    and m.group_id is null
    and m.sender_id <> auth.uid()
    and public.is_church_member(p_church)
    and m.created_at > coalesce(
      (select r.last_read_at from public.church_chat_reads r
        where r.church_id = p_church and r.user_id = auth.uid()),
      (select ms.created_at from public.memberships ms
        where ms.church_id = p_church and ms.user_id = auth.uid())
    );
$$;

-- One row for General (group_id null) and one for each group the caller is in: other people's messages since
-- the caller last read that chat, or since they joined the group if they never opened it.
create function public.chat_unread_counts(p_church uuid)
returns table (group_id uuid, unread integer)
language sql stable security definer set search_path = ''
as $$
  select null::uuid, public.church_chat_unread_count(p_church)
  where public.is_church_member(p_church)
  union all
  select g.id,
    (
      select count(*)::integer
      from public.church_chat_messages m
      where m.group_id = g.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          (select r.last_read_at from public.chat_group_reads r where r.group_id = g.id and r.user_id = auth.uid()),
          gm.created_at
        )
    )
  from public.chat_groups g
  join public.chat_group_members gm on gm.group_id = g.id and gm.user_id = auth.uid()
  where g.church_id = p_church and public.is_chat_group_member(g.id, p_church);
$$;

create function public.mark_chat_group_read(p_group uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
begin
  select church_id into v_church from public.chat_groups where id = p_group;
  if auth.uid() is null or v_church is null or not public.is_chat_group_member(p_group, v_church) then
    return;
  end if;
  insert into public.chat_group_reads (group_id, user_id, last_read_at)
  values (p_group, auth.uid(), now())
  on conflict (group_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Looking at groups
-- ---------------------------------------------------------------------------

-- The groups the caller is in.
create function public.my_chat_groups(p_church uuid)
returns table (id uuid, name text, description text, member_count integer, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, g.description,
    (select count(*)::integer
       from public.chat_group_members gm2
       join public.memberships ms on ms.church_id = g.church_id and ms.user_id = gm2.user_id and ms.status = 'approved'
      where gm2.group_id = g.id),
    g.created_at
  from public.chat_groups g
  where g.church_id = p_church
    and public.is_church_member(p_church)
    and public.is_chat_group_member(g.id, p_church)
  order by lower(g.name);
$$;

-- Every group in the church with its size, for the people who manage them. Names and counts only, never messages.
create function public.manageable_chat_groups(p_church uuid)
returns table (id uuid, name text, description text, member_count integer, i_am_member boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_manage_chat_groups(p_church) then
    raise exception 'Only the Pastor and elders can manage chat groups' using errcode = '42501';
  end if;
  return query
  select g.id, g.name, g.description,
    (select count(*)::integer
       from public.chat_group_members gm2
       join public.memberships ms on ms.church_id = g.church_id and ms.user_id = gm2.user_id and ms.status = 'approved'
      where gm2.group_id = g.id),
    public.is_chat_group_member(g.id, p_church),
    g.created_at
  from public.chat_groups g
  where g.church_id = p_church
  order by lower(g.name);
end;
$$;

-- Who is in a group. The people in it and the people who manage groups can ask. Done here because the member
-- directory rules can hide a profile from a fellow member.
create function public.chat_group_members_list(p_group uuid)
returns table (user_id uuid, full_name text, avatar_path text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_church uuid;
begin
  select church_id into v_church from public.chat_groups where id = p_group;
  if v_church is null or not (public.is_chat_group_member(p_group, v_church) or public.can_manage_chat_groups(v_church)) then
    raise exception 'You cannot see who is in this group' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.avatar_path
  from public.chat_group_members gm
  join public.memberships ms on ms.church_id = v_church and ms.user_id = gm.user_id and ms.status = 'approved'
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group
  order by lower(p.full_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Managing groups (the Pastor and elders)
-- ---------------------------------------------------------------------------

-- Every id must be an approved member of the church, and a group stays a sensible size.
create function public.chat_members_valid(p_church uuid, p_members uuid[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(cardinality(p_members), 0) <= 500
    and (select count(distinct u) from unnest(coalesce(p_members, '{}'::uuid[])) as u)
      = (select count(*) from public.memberships
          where church_id = p_church and status = 'approved' and user_id = any (coalesce(p_members, '{}'::uuid[])));
$$;

create function public.create_chat_group(p_church uuid, p_name text, p_description text, p_members uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
begin
  if auth.uid() is null or not public.can_manage_chat_groups(p_church) then
    raise exception 'Only the Pastor and elders can create chat groups' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'Give the group a name of up to 60 characters';
  end if;
  if char_length(coalesce(p_description, '')) > 200 then
    raise exception 'The description can be up to 200 characters';
  end if;
  if (select count(*) from public.chat_groups where church_id = p_church) >= 30 then
    raise exception 'A church can have up to 30 chat groups';
  end if;
  if exists (select 1 from public.chat_groups where church_id = p_church and lower(trim(name)) = lower(v_name)) then
    raise exception 'There is already a group with that name';
  end if;
  if not public.chat_members_valid(p_church, p_members) then
    raise exception 'Everyone in a group has to be an approved member of the church';
  end if;

  insert into public.chat_groups (church_id, name, description, created_by)
  values (p_church, v_name, trim(coalesce(p_description, '')), auth.uid())
  returning id into v_id;

  insert into public.chat_group_members (group_id, user_id, added_by)
  select v_id, u, auth.uid() from (select distinct unnest(coalesce(p_members, '{}'::uuid[])) as u) m;

  return v_id;
end;
$$;

create function public.update_chat_group(p_group uuid, p_name text, p_description text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  select church_id into v_church from public.chat_groups where id = p_group;
  if auth.uid() is null or v_church is null or not public.can_manage_chat_groups(v_church) then
    raise exception 'Only the Pastor and elders can change chat groups' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'Give the group a name of up to 60 characters';
  end if;
  if char_length(coalesce(p_description, '')) > 200 then
    raise exception 'The description can be up to 200 characters';
  end if;
  if exists (
    select 1 from public.chat_groups
    where church_id = v_church and id <> p_group and lower(trim(name)) = lower(v_name)
  ) then
    raise exception 'There is already a group with that name';
  end if;
  update public.chat_groups set name = v_name, description = trim(coalesce(p_description, '')) where id = p_group;
end;
$$;

-- Replaces who is in the group in one step. People already in it keep their place and their read position.
create function public.set_chat_group_members(p_group uuid, p_members uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
begin
  select church_id into v_church from public.chat_groups where id = p_group;
  if auth.uid() is null or v_church is null or not public.can_manage_chat_groups(v_church) then
    raise exception 'Only the Pastor and elders can change who is in a group' using errcode = '42501';
  end if;
  if not public.chat_members_valid(v_church, p_members) then
    raise exception 'Everyone in a group has to be an approved member of the church';
  end if;

  delete from public.chat_group_members
  where group_id = p_group and not (user_id = any (coalesce(p_members, '{}'::uuid[])));
  delete from public.chat_group_reads
  where group_id = p_group and not (user_id = any (coalesce(p_members, '{}'::uuid[])));

  insert into public.chat_group_members (group_id, user_id, added_by)
  select p_group, u, auth.uid() from (select distinct unnest(coalesce(p_members, '{}'::uuid[])) as u) m
  on conflict do nothing;
end;
$$;

-- The group and all its messages go.
create function public.delete_chat_group(p_group uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
begin
  select church_id into v_church from public.chat_groups where id = p_group;
  if auth.uid() is null or v_church is null or not public.can_manage_chat_groups(v_church) then
    raise exception 'Only the Pastor and elders can delete chat groups' using errcode = '42501';
  end if;
  delete from public.chat_groups where id = p_group;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------

revoke all on function
  public.is_chat_group_member(uuid, uuid), public.can_manage_chat_groups(uuid), public.church_chat_feed(uuid, integer, uuid),
  public.chat_unread_counts(uuid), public.mark_chat_group_read(uuid), public.my_chat_groups(uuid),
  public.manageable_chat_groups(uuid), public.chat_group_members_list(uuid), public.chat_members_valid(uuid, uuid[]),
  public.create_chat_group(uuid, text, text, uuid[]), public.update_chat_group(uuid, text, text),
  public.set_chat_group_members(uuid, uuid[]), public.delete_chat_group(uuid)
  from public, anon;

grant execute on function
  public.is_chat_group_member(uuid, uuid), public.can_manage_chat_groups(uuid), public.church_chat_feed(uuid, integer, uuid),
  public.chat_unread_counts(uuid), public.mark_chat_group_read(uuid), public.my_chat_groups(uuid),
  public.manageable_chat_groups(uuid), public.chat_group_members_list(uuid), public.chat_members_valid(uuid, uuid[]),
  public.create_chat_group(uuid, text, text, uuid[]), public.update_chat_group(uuid, text, text),
  public.set_chat_group_members(uuid, uuid[]), public.delete_chat_group(uuid)
  to authenticated;
