-- Q&A: the Pastor decides who sees a question.
--
-- A new question is visible only to the Pastor (and, if it was asked under a name, to the person who
-- asked it). Only the Pastor answers. The Pastor then chooses its visibility:
--   'pastor'  - only the Pastor (the starting point),
--   'leaders' - the church leaders: Pastor, elders and admins,
--   'church'  - every member of the church.
-- A question can be shared with the whole church only once it has an answer. Sharing with the leaders
-- needs no answer, so the Pastor can pass a question along for the elders to read.
--
-- This replaces the simple shared / not shared flag from the earlier Q&A migrations.

alter table public.questions
  add column visibility text not null default 'pastor' check (visibility in ('pastor', 'leaders', 'church'));

-- Questions already shared with everyone stay shared; the rest start with the Pastor.
update public.questions set visibility = 'church' where is_published;

drop function public.publish_question(uuid, boolean);
drop function public.qa_feed(uuid);

alter table public.questions
  drop column is_published,
  drop column published_at;

create function public.qa_feed(p_church uuid)
returns table (
  id uuid,
  body text,
  asker_name text,
  is_mine boolean,
  asked_at timestamptz,
  answer text,
  answered_by_name text,
  answered_at timestamptz,
  visibility text
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
         q.answered_at,
         q.visibility
  from public.questions q
  left join public.profiles asker on asker.id = q.asker_id
  left join public.profiles answerer on answerer.id = q.answered_by
  where q.church_id = p_church
    and public.is_church_member(p_church)
    and (
      q.visibility = 'church'
      or (q.visibility = 'leaders' and public.is_church_leader(p_church))
      or public.has_church_role(p_church, array['pastor']::public.member_role[])
      or (q.asker_id is not null and q.asker_id = auth.uid())
    )
  order by q.answered_at desc nulls last, q.asked_at desc
  limit 200;
$$;

-- Only the Pastor answers a question, or changes their answer.
create or replace function public.answer_question(p_question uuid, p_answer text)
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
    and public.has_church_role(church_id, array['pastor']::public.member_role[]);
  if not found then
    raise exception 'Only the Pastor can answer questions' using errcode = '42501';
  end if;
end;
$$;

-- The Pastor chooses who sees a question: only them, the church leaders, or the whole church.
create function public.set_question_visibility(p_question uuid, p_visibility text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_visibility not in ('pastor', 'leaders', 'church') then
    raise exception 'Choose who can see this question';
  end if;
  update public.questions
  set visibility = p_visibility
  where id = p_question
    and public.is_church_member(church_id)
    and public.has_church_role(church_id, array['pastor']::public.member_role[])
    and (p_visibility <> 'church' or answer is not null);
  if not found then
    raise exception 'Answer the question first, then you can share it with the whole church';
  end if;
end;
$$;

-- The Pastor can remove any question. The person who asked a named question can remove their own.
create or replace function public.delete_question(p_question uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.questions
  where id = p_question
    and public.is_church_member(church_id)
    and (
      public.has_church_role(church_id, array['pastor']::public.member_role[])
      or (asker_id is not null and asker_id = auth.uid())
    );
  if not found then
    raise exception 'You can''t remove this question' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.qa_feed(uuid), public.set_question_visibility(uuid, text) from public, anon;
grant execute on function public.qa_feed(uuid), public.set_question_visibility(uuid, text) to authenticated;
