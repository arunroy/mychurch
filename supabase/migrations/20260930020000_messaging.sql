-- Phase 2: private one-to-one messages between members of a church.
--
-- Any approved member can message any other approved member they are allowed to
-- reach (see can_message). Only the two people in a conversation can read it:
-- not other members, not church leaders, not church admins, not platform admins.
-- Writes that need more than a row check go through security definer functions.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  -- Always stored in order (user_a < user_b) so a pair has exactly one conversation per church.
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Null until the first message; conversations nobody has written in stay out of the inbox.
  last_message_at timestamptz,
  last_message_preview text not null default '',
  last_sender_id uuid references public.profiles (id) on delete set null,
  last_read_a timestamptz not null default now(),
  last_read_b timestamptz not null default now(),
  constraint conversations_ordered check (user_a < user_b),
  constraint conversations_unique_pair unique (church_id, user_a, user_b)
);

create index conversations_user_a_idx on public.conversations (user_a);
create index conversations_user_b_idx on public.conversations (user_b);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The caller is one of the two people in the conversation and still belongs to its church.
create function public.is_conversation_participant(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation
      and auth.uid() in (c.user_a, c.user_b)
      and public.is_church_member(c.church_id)
  );
$$;

-- Whether the caller may start a conversation with someone. Leaders can always be
-- reached, and can reach anyone; otherwise the person must be in the church directory.
create function public.can_message(p_church uuid, p_other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and p_other <> auth.uid()
    and public.is_church_member(p_church)
    and exists (
      select 1
      from public.memberships m
      join public.churches c on c.id = m.church_id
      where m.church_id = p_church
        and m.user_id = p_other
        and m.status = 'approved'
        and c.status = 'active'
        and (
          m.role in ('pastor', 'elder', 'admin')
          or public.is_church_leader(p_church)
          or (m.directory_visible and c.directory_enabled)
        )
    );
$$;

-- Sending needs both people to still be approved members: if one is removed the chat goes quiet.
create function public.can_send_in(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation
      and auth.uid() in (c.user_a, c.user_b)
      and public.is_church_member(c.church_id)
      and exists (
        select 1 from public.memberships m
        where m.church_id = c.church_id
          and m.user_id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
          and m.status = 'approved'
      )
  );
$$;

-- Keeps the inbox row current: latest message, who sent it, and the sender has read up to it.
create function public.handle_new_message()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = left(new.body, 140),
      last_sender_id = new.sender_id,
      last_read_a = case when user_a = new.sender_id then new.created_at else last_read_a end,
      last_read_b = case when user_b = new.sender_id then new.created_at else last_read_b end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_created
  after insert on public.messages
  for each row execute function public.handle_new_message();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.messages from anon, authenticated;

grant select on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

create policy "conversations: the two people in them"
  on public.conversations for select to authenticated
  using (auth.uid() in (user_a, user_b) and public.is_church_member(church_id));

create policy "messages: the two people in the conversation read them"
  on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "messages: send in your own name to someone still in the church"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send_in(conversation_id));

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

-- Finds or creates the conversation between the caller and someone else in a church.
create function public.start_conversation(p_church uuid, p_other uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.can_message(p_church, p_other) then
    raise exception 'You can''t message this person' using errcode = '42501';
  end if;

  insert into public.conversations (church_id, user_a, user_b)
  values (p_church, least(auth.uid(), p_other), greatest(auth.uid(), p_other))
  on conflict (church_id, user_a, user_b) do nothing;

  select id into v_id from public.conversations
  where church_id = p_church
    and user_a = least(auth.uid(), p_other)
    and user_b = greatest(auth.uid(), p_other);
  return v_id;
end;
$$;

create function public.mark_conversation_read(p_conversation uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.conversations
  set last_read_a = case when user_a = auth.uid() then now() else last_read_a end,
      last_read_b = case when user_b = auth.uid() then now() else last_read_b end
  where id = p_conversation
    and auth.uid() in (user_a, user_b)
    and public.is_church_member(church_id);
$$;

-- The caller's inbox for a church. Returns the other person's name and photo itself,
-- because profile visibility rules might hide someone the caller is already chatting with.
create function public.my_conversations(p_church uuid)
returns table (
  id uuid,
  other_user_id uuid,
  other_name text,
  other_avatar_path text,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_id uuid,
  unread boolean
)
language sql stable security definer set search_path = ''
as $$
  select c.id,
         o.id,
         o.full_name,
         o.avatar_path,
         c.last_message_at,
         c.last_message_preview,
         c.last_sender_id,
         c.last_sender_id is distinct from auth.uid()
           and c.last_message_at > case when c.user_a = auth.uid() then c.last_read_a else c.last_read_b end
  from public.conversations c
  join public.profiles o on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  where c.church_id = p_church
    and auth.uid() in (c.user_a, c.user_b)
    and c.last_message_at is not null
    and public.is_church_member(p_church)
  order by c.last_message_at desc;
$$;

-- People the caller can start a conversation with, for the "new message" picker.
create function public.messageable_members(p_church uuid)
returns table (user_id uuid, full_name text, avatar_path text, role public.member_role)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.full_name, p.avatar_path, m.role
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.church_id = p_church
    and m.user_id <> auth.uid()
    and public.can_message(p_church, m.user_id)
  order by p.full_name;
$$;

revoke execute on function
  public.is_conversation_participant(uuid),
  public.can_message(uuid, uuid),
  public.can_send_in(uuid),
  public.handle_new_message(),
  public.start_conversation(uuid, uuid),
  public.mark_conversation_read(uuid),
  public.my_conversations(uuid),
  public.messageable_members(uuid)
from public, anon;

grant execute on function
  public.is_conversation_participant(uuid),
  public.can_message(uuid, uuid),
  public.can_send_in(uuid),
  public.start_conversation(uuid, uuid),
  public.mark_conversation_read(uuid),
  public.my_conversations(uuid),
  public.messageable_members(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates. Realtime applies the row level security above, so people only
-- ever receive their own conversations. Skipped where Realtime isn't installed.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.conversations;
  end if;
end $$;
