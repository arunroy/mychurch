-- Phase 0 foundations: churches, members, roles, push tokens.
--
-- Every church-owned row carries church_id, and every policy checks the caller's
-- approved membership in that church. Writes that need more than a row check
-- (registering, joining, approving, changing roles) go through security definer
-- functions so the rules live in one place.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.church_status as enum ('pending', 'active', 'suspended');
create type public.member_role as enum ('pastor', 'elder', 'admin', 'member');
create type public.membership_status as enum ('pending', 'approved');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  city text not null default '' check (char_length(city) <= 120),
  contact_email text not null default '' check (char_length(contact_email) <= 254),
  accent_color text not null default '#3B5BDB' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path text,
  status public.church_status not null default 'pending',
  requires_approval boolean not null default true,
  directory_enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

-- Kept apart from churches so that seeing a church never reveals how to join it.
create table public.church_join_codes (
  church_id uuid primary key references public.churches (id) on delete cascade,
  code text not null unique,
  updated_at timestamptz not null default now()
);

create table public.memberships (
  church_id uuid not null references public.churches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  status public.membership_status not null default 'pending',
  directory_visible boolean not null default true,
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  primary key (church_id, user_id),
  -- Same id as auth.users; this second key lets the API embed a member's profile.
  constraint memberships_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade
);

create index memberships_user_idx on public.memberships (user_id);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Helpers used by policies. Security definer so policies on memberships can
-- consult memberships without recursing into their own RLS.
-- ---------------------------------------------------------------------------

create function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function public.is_church_member(p_church uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where church_id = p_church and user_id = auth.uid() and status = 'approved'
  );
$$;

create function public.has_church_role(p_church uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where church_id = p_church and user_id = auth.uid()
      and status = 'approved' and role = any (p_roles)
  );
$$;

-- Pastor, elders and church admins: the people who run a church day to day.
create function public.is_church_leader(p_church uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_church_role(p_church, array['pastor', 'elder', 'admin']::public.member_role[]);
$$;

create function public.has_any_membership(p_church uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships where church_id = p_church and user_id = auth.uid()
  );
$$;

-- Whether the caller may see another person's profile: they share a church and
-- either the other person is listed in its directory or the caller leads it.
create function public.can_see_profile(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user = auth.uid() or public.is_platform_admin() or exists (
    select 1
    from public.memberships them
    join public.memberships me
      on me.church_id = them.church_id and me.user_id = auth.uid() and me.status = 'approved'
    join public.churches c on c.id = them.church_id
    where them.user_id = p_user
      and (
        me.role in ('pastor', 'elder', 'admin')
        or (them.status = 'approved' and them.directory_visible and c.directory_enabled)
      )
  );
$$;

create function public.new_join_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  -- No 0/O or 1/I/L, so codes survive being read aloud or written on a bulletin.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text;
begin
  loop
    result := '';
    for i in 1..8 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.church_join_codes where code = result);
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles are created with the account.
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.churches enable row level security;
alter table public.church_join_codes enable row level security;
alter table public.memberships enable row level security;
alter table public.push_tokens enable row level security;

revoke all on public.profiles, public.platform_admins, public.churches,
  public.church_join_codes, public.memberships, public.push_tokens from anon, authenticated;

-- profiles
grant select on public.profiles to authenticated;
grant update (full_name, avatar_path) on public.profiles to authenticated;

create policy "profiles: visible to people who share a church"
  on public.profiles for select to authenticated
  using (public.can_see_profile(id));

create policy "profiles: edit your own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- platform_admins: only readable, and only by yourself (lets the app show the admin screen).
grant select on public.platform_admins to authenticated;

create policy "platform_admins: see your own row"
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- churches: anyone with a membership (even pending) sees their church; search goes through search_churches().
grant select on public.churches to authenticated;
grant update (name, city, contact_email, accent_color, logo_path, requires_approval, directory_enabled)
  on public.churches to authenticated;

create policy "churches: visible to its members and platform admins"
  on public.churches for select to authenticated
  using (public.has_any_membership(id) or public.is_platform_admin());

create policy "churches: pastor and church admin edit settings"
  on public.churches for update to authenticated
  using (public.has_church_role(id, array['pastor', 'admin']::public.member_role[]))
  with check (public.has_church_role(id, array['pastor', 'admin']::public.member_role[]));

-- church_join_codes: leaders only.
grant select on public.church_join_codes to authenticated;

create policy "join codes: visible to church leaders"
  on public.church_join_codes for select to authenticated
  using (public.is_church_leader(church_id));

-- memberships
grant select on public.memberships to authenticated;
grant update (directory_visible) on public.memberships to authenticated;

create policy "memberships: your own"
  on public.memberships for select to authenticated
  using (user_id = auth.uid());

create policy "memberships: church directory"
  on public.memberships for select to authenticated
  using (
    status = 'approved' and directory_visible and public.is_church_member(church_id)
    and exists (select 1 from public.churches c where c.id = church_id and c.directory_enabled)
  );

create policy "memberships: leaders see everyone in their church"
  on public.memberships for select to authenticated
  using (public.is_church_leader(church_id));

create policy "memberships: platform admins"
  on public.memberships for select to authenticated
  using (public.is_platform_admin());

create policy "memberships: change your own directory visibility"
  on public.memberships for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- push_tokens: your own devices only.
grant select, insert, update, delete on public.push_tokens to authenticated;

create policy "push tokens: your own"
  on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

create function public.register_church(
  p_name text,
  p_city text,
  p_contact_email text,
  p_accent_color text default '#3B5BDB'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  insert into public.churches (name, city, contact_email, accent_color, created_by)
  values (trim(p_name), trim(coalesce(p_city, '')), trim(coalesce(p_contact_email, '')),
          coalesce(p_accent_color, '#3B5BDB'), auth.uid())
  returning id into v_church;

  insert into public.memberships (church_id, user_id, role, status, approved_by, approved_at)
  values (v_church, auth.uid(), 'pastor', 'approved', auth.uid(), now());

  insert into public.church_join_codes (church_id, code) values (v_church, public.new_join_code());

  return v_church;
end;
$$;

create function public.join_church_by_code(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_church uuid;
  v_requires_approval boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;

  select c.id, c.requires_approval into v_church, v_requires_approval
  from public.church_join_codes j
  join public.churches c on c.id = j.church_id
  where j.code = upper(trim(p_code)) and c.status = 'active';

  if v_church is null then
    raise exception 'That code doesn''t match any church' using errcode = 'P0002';
  end if;

  insert into public.memberships (church_id, user_id, status, approved_at)
  values (v_church, auth.uid(),
          case when v_requires_approval then 'pending' else 'approved' end::public.membership_status,
          case when v_requires_approval then null else now() end)
  on conflict (church_id, user_id) do nothing;

  return v_church;
end;
$$;

-- Found by search rather than given a code, so a leader always approves.
create function public.request_to_join(p_church uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not exists (select 1 from public.churches where id = p_church and status = 'active') then
    raise exception 'Church not found' using errcode = 'P0002';
  end if;

  insert into public.memberships (church_id, user_id, status)
  values (p_church, auth.uid(), 'pending')
  on conflict (church_id, user_id) do nothing;
end;
$$;

create function public.search_churches(p_query text)
returns table (id uuid, name text, city text, accent_color text, logo_path text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.city, c.accent_color, c.logo_path
  from public.churches c
  where c.status = 'active'
    and char_length(trim(p_query)) >= 2
    and (c.name ilike '%' || trim(p_query) || '%' or c.city ilike '%' || trim(p_query) || '%')
  order by c.name
  limit 25;
$$;

create function public.approve_member(p_church uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_church_leader(p_church) then
    raise exception 'Only the Pastor, elders or church admins can approve members' using errcode = '42501';
  end if;

  update public.memberships
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where church_id = p_church and user_id = p_user and status = 'pending';
end;
$$;

-- Declining a request and removing a member are the same act: the membership goes away.
create function public.remove_member(p_church uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_target_role public.member_role;
begin
  select role into v_target_role from public.memberships
  where church_id = p_church and user_id = p_user;

  if v_target_role is null then
    return;
  end if;

  if p_user = auth.uid() then
    null; -- leaving your own church is always allowed, subject to the last-pastor check below
  elsif v_target_role in ('pastor', 'elder', 'admin') then
    if not public.has_church_role(p_church, array['pastor']::public.member_role[]) then
      raise exception 'Only a Pastor can remove leaders' using errcode = '42501';
    end if;
  elsif not public.is_church_leader(p_church) then
    raise exception 'Only the Pastor, elders or church admins can remove members' using errcode = '42501';
  end if;

  if v_target_role = 'pastor' and (
    select count(*) from public.memberships
    where church_id = p_church and role = 'pastor' and status = 'approved'
  ) <= 1 then
    raise exception 'A church needs at least one Pastor. Make someone else Pastor first.' using errcode = '23514';
  end if;

  delete from public.memberships where church_id = p_church and user_id = p_user;
end;
$$;

create function public.set_member_role(p_church uuid, p_user uuid, p_role public.member_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_current public.member_role;
begin
  if not public.has_church_role(p_church, array['pastor']::public.member_role[]) then
    raise exception 'Only a Pastor can change roles' using errcode = '42501';
  end if;

  select role into v_current from public.memberships
  where church_id = p_church and user_id = p_user and status = 'approved';

  if v_current is null then
    raise exception 'Approve this person before giving them a role' using errcode = 'P0002';
  end if;

  if v_current = 'pastor' and p_role <> 'pastor' and (
    select count(*) from public.memberships
    where church_id = p_church and role = 'pastor' and status = 'approved'
  ) <= 1 then
    raise exception 'A church needs at least one Pastor. Make someone else Pastor first.' using errcode = '23514';
  end if;

  update public.memberships set role = p_role where church_id = p_church and user_id = p_user;
end;
$$;

create function public.regenerate_join_code(p_church uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.has_church_role(p_church, array['pastor', 'admin']::public.member_role[]) then
    raise exception 'Only a Pastor or church admin can change the join code' using errcode = '42501';
  end if;

  v_code := public.new_join_code();
  update public.church_join_codes set code = v_code, updated_at = now() where church_id = p_church;
  return v_code;
end;
$$;

create function public.set_church_status(p_church uuid, p_status public.church_status)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can verify churches' using errcode = '42501';
  end if;

  update public.churches
  set status = p_status,
      verified_at = case when p_status = 'active' then coalesce(verified_at, now()) else verified_at end
  where id = p_church;
end;
$$;

-- Platform admins review churches waiting for verification.
create function public.list_churches_for_review(p_status public.church_status default 'pending')
returns table (id uuid, name text, city text, contact_email text, created_at timestamptz,
               created_by_name text, member_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can review churches' using errcode = '42501';
  end if;

  return query
  select c.id, c.name, c.city, c.contact_email, c.created_at, p.full_name,
         (select count(*) from public.memberships m where m.church_id = c.id)
  from public.churches c
  left join public.profiles p on p.id = c.created_by
  where c.status = p_status
  order by c.created_at;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.register_church(text, text, text, text),
  public.join_church_by_code(text),
  public.request_to_join(uuid),
  public.search_churches(text),
  public.approve_member(uuid, uuid),
  public.remove_member(uuid, uuid),
  public.set_member_role(uuid, uuid, public.member_role),
  public.regenerate_join_code(uuid),
  public.set_church_status(uuid, public.church_status),
  public.list_churches_for_review(public.church_status),
  public.is_platform_admin(),
  public.is_church_member(uuid),
  public.has_church_role(uuid, public.member_role[]),
  public.is_church_leader(uuid),
  public.has_any_membership(uuid),
  public.can_see_profile(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: church logos live under church-logos/<church_id>/..., profile
-- photos under avatars/<user_id>/... Both are public to read (they're shown
-- on join screens), and only the owner can write.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('church-logos', 'church-logos', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "church logos: pastor and church admin upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'church-logos'
    and public.has_church_role(((storage.foldername(name))[1])::uuid, array['pastor', 'admin']::public.member_role[])
  );

create policy "church logos: pastor and church admin replace"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'church-logos'
    and public.has_church_role(((storage.foldername(name))[1])::uuid, array['pastor', 'admin']::public.member_role[])
  );

create policy "church logos: pastor and church admin delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'church-logos'
    and public.has_church_role(((storage.foldername(name))[1])::uuid, array['pastor', 'admin']::public.member_role[])
  );

create policy "avatars: upload your own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: replace your own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: delete your own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
