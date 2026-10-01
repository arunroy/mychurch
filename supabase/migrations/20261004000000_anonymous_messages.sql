-- Anonymous messages to the Pastor.
--
-- A member can write to the Pastor without their name being kept anywhere with the message:
--   * The message row has no author column at all, and only a date (no time) of when it was sent.
--   * Spam is limited by a small counter of how many anonymous things each person sent today. The
--     counter is a separate table that holds no message ids, so it cannot be joined to a message.
--   * If the sender wants an answer, they are shown a reply code once. Only a hash of the code is
--     stored. They come back later, enter the code, and see the Pastor's reply. Without the code
--     nobody can link a reply to a person, including the Pastor.
--
-- What this does not hide: someone with raw access to the database could see that a given person
-- used an anonymous slot on a given day, and could guess from the date. It is private from the app,
-- from other members and from the church's leaders, not from the people who run the database.
--
-- Both tables are closed to direct access; everything goes through the functions below.

create table public.anonymous_messages (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  -- A date only. No time, so the message cannot be matched to when someone was online.
  sent_on date not null default current_date,
  -- Hash of the reply code. Null when the sender did not ask for a reply.
  code_hash text unique,
  is_read boolean not null default false,
  reply text check (reply is null or char_length(trim(reply)) between 1 and 2000),
  replied_on date
);

create index anonymous_messages_church_idx on public.anonymous_messages (church_id, sent_on desc);

-- How many anonymous things a person has sent today, to stop floods. Shared with anonymous questions.
-- It holds no message ids and no church, so it cannot be tied to anything that was sent.
create table public.anonymity_limits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  day date not null,
  sends integer not null default 0,
  primary key (user_id, kind, day)
);

alter table public.anonymous_messages enable row level security;
alter table public.anonymity_limits enable row level security;
revoke all on public.anonymous_messages, public.anonymity_limits from anon, authenticated;

-- Counts one more anonymous send of this kind today, or refuses once the daily limit is used up.
create function public.take_anonymity_slot(p_kind text, p_limit integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_sends integer;
begin
  -- Old counters are not needed; keep the table tiny.
  delete from public.anonymity_limits where day < current_date - 1;

  insert into public.anonymity_limits (user_id, kind, day, sends)
  values (auth.uid(), p_kind, current_date, 1)
  on conflict (user_id, kind, day) do update set sends = public.anonymity_limits.sends + 1
  returning sends into v_sends;

  if v_sends > p_limit then
    raise exception 'You have reached today''s limit. Please try again tomorrow.';
  end if;
end;
$$;

revoke execute on function public.take_anonymity_slot(text, integer) from public, anon, authenticated;

-- Reply codes are compared by hash, ignoring dashes, spaces and case.
create function public.anonymous_code_hash(p_code text)
returns text
language sql immutable set search_path = ''
as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
$$;

revoke execute on function public.anonymous_code_hash(text) from public, anon, authenticated;

-- Sends an anonymous message to the Pastor. Returns a reply code if the sender asked for one, shown only now.
create function public.send_anonymous_message(p_church uuid, p_body text, p_want_reply boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_raw text;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.is_church_member(p_church) then
    raise exception 'Only members of this church can write to the Pastor' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Write a message of up to 2000 characters';
  end if;

  perform public.take_anonymity_slot('message', 3);

  if p_want_reply then
    v_raw := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    v_code := substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4) || '-' || substr(v_raw, 13, 4);
  end if;

  insert into public.anonymous_messages (church_id, body, code_hash)
  values (p_church, trim(p_body), case when p_want_reply then public.anonymous_code_hash(v_code) end);

  return v_code;
end;
$$;

-- The sender comes back with their code and sees the Pastor's reply, if there is one yet.
create function public.check_anonymous_reply(p_code text)
returns table (found boolean, body text, reply text, replied_on date)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  return query
  select true, m.body, m.reply, m.replied_on
  from public.anonymous_messages m
  where m.code_hash = public.anonymous_code_hash(p_code);
  if not found then
    return query select false, null::text, null::text, null::date;
  end if;
end;
$$;

-- The Pastor's inbox: unread first, newest first.
create function public.anonymous_inbox(p_church uuid)
returns table (id uuid, body text, sent_on date, can_reply boolean, is_read boolean, reply text, replied_on date)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.body, m.sent_on, m.code_hash is not null, m.is_read, m.reply, m.replied_on
  from public.anonymous_messages m
  where m.church_id = p_church
    and public.has_church_role(p_church, array['pastor']::public.member_role[])
  order by m.is_read, m.sent_on desc
  limit 200;
$$;

create function public.mark_anonymous_read(p_message uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.anonymous_messages
  set is_read = true
  where id = p_message and public.has_church_role(church_id, array['pastor']::public.member_role[]);
$$;

-- Only possible when the sender asked for a reply and so holds a code.
create function public.reply_to_anonymous(p_message uuid, p_reply text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if char_length(trim(coalesce(p_reply, ''))) not between 1 and 2000 then
    raise exception 'Write a reply of up to 2000 characters';
  end if;
  update public.anonymous_messages
  set reply = trim(p_reply), replied_on = current_date, is_read = true
  where id = p_message
    and code_hash is not null
    and public.has_church_role(church_id, array['pastor']::public.member_role[]);
  if not found then
    raise exception 'You can''t reply to this message' using errcode = '42501';
  end if;
end;
$$;

create function public.delete_anonymous_message(p_message uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.anonymous_messages
  where id = p_message and public.has_church_role(church_id, array['pastor']::public.member_role[]);
  if not found then
    raise exception 'You can''t remove this message' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function
  public.send_anonymous_message(uuid, text, boolean),
  public.check_anonymous_reply(text),
  public.anonymous_inbox(uuid),
  public.mark_anonymous_read(uuid),
  public.reply_to_anonymous(uuid, text),
  public.delete_anonymous_message(uuid)
from public, anon;

grant execute on function
  public.send_anonymous_message(uuid, text, boolean),
  public.check_anonymous_reply(text),
  public.anonymous_inbox(uuid),
  public.mark_anonymous_read(uuid),
  public.reply_to_anonymous(uuid, text),
  public.delete_anonymous_message(uuid)
to authenticated;
