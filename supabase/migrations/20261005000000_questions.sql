-- Q&A: members ask the church's leaders questions, and the answers are public.
--
-- A question is either named or fully anonymous. A named question keeps who asked it (so they can
-- take it down and so the name can be shown). An anonymous question keeps nothing about the asker:
-- there is no author on the row and the time is rounded to the day. Because of that, an anonymous
-- question cannot be taken back by its asker; leaders can remove it. Anonymous questions share the
-- small daily limit used for anonymous messages, which holds no link to any question.
--
-- The table is closed to direct access; everything goes through the functions below.

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  -- Null for an anonymous question: nothing here names the asker.
  asker_id uuid references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  -- For anonymous questions this is rounded down to the day.
  asked_at timestamptz not null default now(),
  answer text check (answer is null or char_length(trim(answer)) between 1 and 2000),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz
);

create index questions_church_idx on public.questions (church_id, asked_at desc);

alter table public.questions enable row level security;
revoke all on public.questions from anon, authenticated;

-- Asks a question of the church's leaders.
create function public.ask_question(p_church uuid, p_body text, p_anonymous boolean default false)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.is_church_member(p_church) then
    raise exception 'Only members of this church can ask a question' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 500 then
    raise exception 'Ask a question of up to 500 characters';
  end if;

  if p_anonymous then
    perform public.take_anonymity_slot('question', 5);
    insert into public.questions (church_id, asker_id, body, asked_at)
    values (p_church, null, trim(p_body), date_trunc('day', now()));
  else
    insert into public.questions (church_id, asker_id, body)
    values (p_church, auth.uid(), trim(p_body));
  end if;
end;
$$;

-- Everyone in the church sees the questions and answers. A named question shows its asker; an anonymous one does not.
create function public.qa_feed(p_church uuid)
returns table (
  id uuid,
  body text,
  asker_name text,
  is_mine boolean,
  asked_at timestamptz,
  answer text,
  answered_by_name text,
  answered_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select q.id,
         q.body,
         asker.full_name,
         q.asker_id is not null and q.asker_id = auth.uid(),
         q.asked_at,
         q.answer,
         answerer.full_name,
         q.answered_at
  from public.questions q
  left join public.profiles asker on asker.id = q.asker_id
  left join public.profiles answerer on answerer.id = q.answered_by
  where q.church_id = p_church
    and public.is_church_member(p_church)
  order by q.answered_at desc nulls last, q.asked_at desc
  limit 200;
$$;

-- A leader answers a question, or changes their answer. The answer is public.
create function public.answer_question(p_question uuid, p_answer text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if char_length(trim(coalesce(p_answer, ''))) not between 1 and 2000 then
    raise exception 'Write an answer of up to 2000 characters';
  end if;
  update public.questions
  set answer = trim(p_answer), answered_by = auth.uid(), answered_at = now()
  where id = p_question
    and public.is_church_member(church_id)
    and public.is_church_leader(church_id);
  if not found then
    raise exception 'You can''t answer this question' using errcode = '42501';
  end if;
end;
$$;

-- A leader can remove any question. The person who asked a named question can remove their own.
create function public.delete_question(p_question uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.questions
  where id = p_question
    and public.is_church_member(church_id)
    and (public.is_church_leader(church_id) or (asker_id is not null and asker_id = auth.uid()));
  if not found then
    raise exception 'You can''t remove this question' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function
  public.ask_question(uuid, text, boolean),
  public.qa_feed(uuid),
  public.answer_question(uuid, text),
  public.delete_question(uuid)
from public, anon;

grant execute on function
  public.ask_question(uuid, text, boolean),
  public.qa_feed(uuid),
  public.answer_question(uuid, text),
  public.delete_question(uuid)
to authenticated;
