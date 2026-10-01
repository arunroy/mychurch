-- The church chat: one public room per church. Every approved member can read it and
-- post in it, and everyone sees who wrote what. Leaders (Pastor, elders, admins) can also
-- remove messages, so the room can be kept safe. Private one-to-one messages are separate.

create table public.church_chat_messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index church_chat_messages_church_created_idx
  on public.church_chat_messages (church_id, created_at desc);

alter table public.church_chat_messages enable row level security;
revoke all on public.church_chat_messages from anon, authenticated;
grant select, insert, delete on public.church_chat_messages to authenticated;

create policy "church chat: members read"
  on public.church_chat_messages for select to authenticated
  using (public.is_church_member(church_id));

create policy "church chat: members post in their own name"
  on public.church_chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_church_member(church_id));

create policy "church chat: authors and leaders remove"
  on public.church_chat_messages for delete to authenticated
  using (
    public.is_church_member(church_id)
    and (sender_id = auth.uid() or public.is_church_leader(church_id))
  );

-- The latest messages with each sender's name and photo. Done here rather than by joining
-- profiles in the app, because the directory rules can hide a profile from a fellow member
-- even though what they said in the room is public to everyone in it.
create function public.church_chat_feed(p_church uuid, p_limit integer default 100)
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
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

revoke execute on function public.church_chat_feed(uuid, integer) from public, anon;
grant execute on function public.church_chat_feed(uuid, integer) to authenticated;

-- Live updates. Realtime applies the read policy above. Full replica identity lets it
-- filter removals by church too. Skipped where Realtime isn't installed.
alter table public.church_chat_messages replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.church_chat_messages;
  end if;
end $$;
