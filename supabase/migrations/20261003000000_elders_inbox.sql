-- Message the elders: a shared inbox.
--
-- A member writes to "the elders" and every church leader (Pastor, elders, admins) can read it and
-- reply, with their own name on the reply. Each member has one ongoing thread per church. Only that
-- member and the church's leaders can see it. The tables are closed to direct access; everything goes
-- through the functions below.

create table public.elder_threads (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text not null default '',
  last_sender_id uuid references public.profiles (id) on delete set null,
  -- True while the latest message is the member's and no leader has answered yet.
  needs_reply boolean not null default false,
  member_read_at timestamptz not null default now(),
  constraint elder_threads_one_per_member unique (church_id, member_id)
);

create table public.elder_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.elder_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index elder_messages_thread_created_idx on public.elder_messages (thread_id, created_at desc);

alter table public.elder_threads enable row level security;
alter table public.elder_messages enable row level security;
revoke all on public.elder_threads, public.elder_messages from anon, authenticated;

-- Whether the caller may see a thread: its member, or a leader of its church.
create function public.can_see_elder_thread(p_thread uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.elder_threads t
    where t.id = p_thread
      and public.is_church_member(t.church_id)
      and (t.member_id = auth.uid() or public.is_church_leader(t.church_id))
  );
$$;

revoke execute on function public.can_see_elder_thread(uuid) from public, anon, authenticated;

-- A member writes to the elders, starting their thread if this is the first time.
create function public.send_to_elders(p_church uuid, p_body text)
returns table (thread_id uuid, message_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_thread uuid;
  v_message uuid;
  v_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.is_church_member(p_church) then
    raise exception 'Only members of this church can write to the elders' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'Write a message of up to 2000 characters';
  end if;

  insert into public.elder_threads (church_id, member_id)
  values (p_church, auth.uid())
  on conflict (church_id, member_id) do nothing;
  select t.id into v_thread from public.elder_threads t where t.church_id = p_church and t.member_id = auth.uid();

  insert into public.elder_messages (thread_id, sender_id, body)
  values (v_thread, auth.uid(), v_body)
  returning id into v_message;

  update public.elder_threads
  set last_message_at = now(),
      last_message_preview = left(v_body, 140),
      last_sender_id = auth.uid(),
      needs_reply = true,
      member_read_at = now()
  where id = v_thread;

  return query select v_thread, v_message;
end;
$$;

-- A leader replies to a member's thread. Any leader can; the reply carries their own name.
create function public.reply_as_elder(p_thread uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_thread public.elder_threads;
  v_message uuid;
  v_body text := trim(coalesce(p_body, ''));
begin
  select * into v_thread from public.elder_threads where id = p_thread;
  if not found
     or not public.is_church_member(v_thread.church_id)
     or not public.is_church_leader(v_thread.church_id)
     or v_thread.member_id = auth.uid() then
    raise exception 'You can''t reply to this thread' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'Write a reply of up to 2000 characters';
  end if;

  insert into public.elder_messages (thread_id, sender_id, body)
  values (p_thread, auth.uid(), v_body)
  returning id into v_message;

  update public.elder_threads
  set last_message_at = now(),
      last_message_preview = left(v_body, 140),
      last_sender_id = auth.uid(),
      needs_reply = false
  where id = p_thread;

  return v_message;
end;
$$;

-- The caller's own thread with the elders, if they have started one.
create function public.my_elder_thread(p_church uuid)
returns table (thread_id uuid, last_message_at timestamptz, unread boolean)
language sql stable security definer set search_path = ''
as $$
  select t.id,
         t.last_message_at,
         t.last_sender_id is distinct from auth.uid() and t.last_message_at > t.member_read_at
  from public.elder_threads t
  where t.church_id = p_church
    and t.member_id = auth.uid()
    and public.is_church_member(p_church);
$$;

-- Every thread in the church, for the leaders: ones waiting for a reply first.
create function public.elder_inbox(p_church uuid)
returns table (
  thread_id uuid,
  member_id uuid,
  member_name text,
  member_avatar_path text,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid,
  needs_reply boolean
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.member_id, p.full_name, p.avatar_path,
         t.last_message_at, t.last_message_preview, t.last_sender_id, t.needs_reply
  from public.elder_threads t
  join public.profiles p on p.id = t.member_id
  where t.church_id = p_church
    and t.last_message_at is not null
    and public.is_church_member(p_church)
    and public.is_church_leader(p_church)
  order by t.needs_reply desc, t.last_message_at desc
  limit 200;
$$;

create function public.elder_thread_messages(p_thread uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_name text,
  body text,
  created_at timestamptz,
  from_member boolean
)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.sender_id, p.full_name, m.body, m.created_at, m.sender_id = t.member_id
  from public.elder_messages m
  join public.elder_threads t on t.id = m.thread_id
  join public.profiles p on p.id = m.sender_id
  where m.thread_id = p_thread
    and public.can_see_elder_thread(p_thread)
  order by m.created_at desc
  limit 200;
$$;

-- The member opening their thread counts as reading it. Leaders reading change nothing.
create function public.mark_elder_thread_read(p_thread uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.elder_threads
  set member_read_at = now()
  where id = p_thread and member_id = auth.uid() and public.is_church_member(church_id);
$$;

revoke execute on function
  public.send_to_elders(uuid, text),
  public.reply_as_elder(uuid, text),
  public.my_elder_thread(uuid),
  public.elder_inbox(uuid),
  public.elder_thread_messages(uuid),
  public.mark_elder_thread_read(uuid)
from public, anon;

grant execute on function
  public.send_to_elders(uuid, text),
  public.reply_as_elder(uuid, text),
  public.my_elder_thread(uuid),
  public.elder_inbox(uuid),
  public.elder_thread_messages(uuid),
  public.mark_elder_thread_read(uuid)
to authenticated;
