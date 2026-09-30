-- Prayer requests.
--
-- Any approved member can share a request and choose who sees it: the whole church, the
-- leaders (Pastor, elders, admins), or the Pastor alone. The author always sees their own.
-- Other members tap "I prayed", and everyone who can see a request sees how many have.
--
-- The tables are closed to direct access: visibility is decided in one place, can_see_prayer,
-- and everything goes through the functions below.

create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  visibility text not null default 'church' check (visibility in ('church', 'leaders', 'pastor')),
  answered boolean not null default false,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index prayer_requests_church_created_idx on public.prayer_requests (church_id, created_at desc);

create table public.prayer_prayers (
  request_id uuid not null references public.prayer_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

-- No policies and no grants: nobody touches these tables directly.
alter table public.prayer_requests enable row level security;
alter table public.prayer_prayers enable row level security;
revoke all on public.prayer_requests, public.prayer_prayers from anon, authenticated;

-- Whether the caller may see a request. The one place the visibility rules live.
create function public.can_see_prayer(p_request uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.prayer_requests r
    where r.id = p_request
      and public.is_church_member(r.church_id)
      and (
        r.author_id = auth.uid()
        or r.visibility = 'church'
        or (r.visibility = 'leaders' and public.is_church_leader(r.church_id))
        or (r.visibility = 'pastor' and public.has_church_role(r.church_id, array['pastor']::public.member_role[]))
      )
  );
$$;

revoke execute on function public.can_see_prayer(uuid) from public, anon, authenticated;

create function public.create_prayer_request(p_church uuid, p_body text, p_visibility text default 'church')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.is_church_member(p_church) then
    raise exception 'Only members of this church can share a prayer request' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'Write your request in up to 1000 characters';
  end if;
  if p_visibility not in ('church', 'leaders', 'pastor') then
    raise exception 'Choose who can see this request';
  end if;

  insert into public.prayer_requests (church_id, author_id, body, visibility)
  values (p_church, auth.uid(), trim(p_body), p_visibility)
  returning id into v_id;
  return v_id;
end;
$$;

-- The requests the caller may see: open ones first, newest first.
create function public.prayer_feed(p_church uuid)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar_path text,
  body text,
  visibility text,
  answered boolean,
  answered_at timestamptz,
  created_at timestamptz,
  prayer_count integer,
  i_prayed boolean
)
language sql stable security definer set search_path = ''
as $$
  select r.id,
         r.author_id,
         p.full_name,
         p.avatar_path,
         r.body,
         r.visibility,
         r.answered,
         r.answered_at,
         r.created_at,
         (select count(*)::integer from public.prayer_prayers pp where pp.request_id = r.id),
         exists (select 1 from public.prayer_prayers pp where pp.request_id = r.id and pp.user_id = auth.uid())
  from public.prayer_requests r
  join public.profiles p on p.id = r.author_id
  where r.church_id = p_church
    and public.is_church_member(p_church)
    and public.can_see_prayer(r.id)
  order by r.answered, r.created_at desc
  limit 100;
$$;

-- "I prayed": tap once to add, again to take back. Returns whether the caller now counts as having prayed.
create function public.toggle_prayed(p_request uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_see_prayer(p_request) then
    raise exception 'This request isn''t available' using errcode = '42501';
  end if;

  if exists (select 1 from public.prayer_prayers where request_id = p_request and user_id = auth.uid()) then
    delete from public.prayer_prayers where request_id = p_request and user_id = auth.uid();
    return false;
  end if;
  insert into public.prayer_prayers (request_id, user_id) values (p_request, auth.uid());
  return true;
end;
$$;

-- Only the person who shared a request can say it has been answered, or reopen it.
create function public.set_prayer_answered(p_request uuid, p_answered boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.prayer_requests
  set answered = p_answered,
      answered_at = case when p_answered then now() end
  where id = p_request
    and author_id = auth.uid()
    and public.is_church_member(church_id);
  if not found then
    raise exception 'You can''t change this request' using errcode = '42501';
  end if;
end;
$$;

-- The author can remove their request. A leader can remove one they are able to see, to keep it kind.
create function public.delete_prayer_request(p_request uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.prayer_requests;
begin
  select * into v_request from public.prayer_requests where id = p_request;
  if not found
     or not public.can_see_prayer(p_request)
     or not (v_request.author_id = auth.uid() or public.is_church_leader(v_request.church_id)) then
    raise exception 'You can''t remove this request' using errcode = '42501';
  end if;
  delete from public.prayer_requests where id = p_request;
end;
$$;

revoke execute on function
  public.create_prayer_request(uuid, text, text),
  public.prayer_feed(uuid),
  public.toggle_prayed(uuid),
  public.set_prayer_answered(uuid, boolean),
  public.delete_prayer_request(uuid)
from public, anon;

grant execute on function
  public.create_prayer_request(uuid, text, text),
  public.prayer_feed(uuid),
  public.toggle_prayed(uuid),
  public.set_prayer_answered(uuid, boolean),
  public.delete_prayer_request(uuid)
to authenticated;
