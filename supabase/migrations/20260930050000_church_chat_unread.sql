-- Unread badge for the church chat: remember how far each person has read.
--
-- One row per person per church. Only that person reads or writes it, and only through the
-- two functions below, so nobody can see how far someone else has read.

create table public.church_chat_reads (
  church_id uuid not null references public.churches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (church_id, user_id)
);

alter table public.church_chat_reads enable row level security;
revoke all on public.church_chat_reads from anon, authenticated;

-- Messages from other people since the caller last read the chat. Someone who has never opened
-- it counts from the day they joined, so a long history doesn't show up as hundreds unread.
create function public.church_chat_unread_count(p_church uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer
  from public.church_chat_messages m
  where m.church_id = p_church
    and m.sender_id <> auth.uid()
    and public.is_church_member(p_church)
    and m.created_at > coalesce(
      (select r.last_read_at from public.church_chat_reads r
        where r.church_id = p_church and r.user_id = auth.uid()),
      (select ms.created_at from public.memberships ms
        where ms.church_id = p_church and ms.user_id = auth.uid())
    );
$$;

create function public.mark_church_chat_read(p_church uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_church_member(p_church) then
    return;
  end if;
  insert into public.church_chat_reads (church_id, user_id, last_read_at)
  values (p_church, auth.uid(), now())
  on conflict (church_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke execute on function public.church_chat_unread_count(uuid), public.mark_church_chat_read(uuid) from public, anon;
grant execute on function public.church_chat_unread_count(uuid), public.mark_church_chat_read(uuid) to authenticated;
