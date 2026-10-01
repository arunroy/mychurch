-- Q&A review: a question is private until a leader shares it.
--
-- A new question can be seen only by the church's leaders (the Pastor, elders and admins) and, if it
-- was asked under a name, by the person who asked it. A leader answers it, and if they think the
-- question and answer will help everyone they share it, which makes both visible to every member.
-- A leader can make a shared question private again. A question can only be shared once it has an
-- answer.
--
-- Someone who asked anonymously has no identity stored, so the app cannot show them their answer
-- privately; they only see it if a leader shares it.

alter table public.questions
  add column is_published boolean not null default false,
  add column published_at timestamptz;

-- The feed now says whether each question is shared, and shows only what the caller may see.
-- The columns change, so the old function has to be dropped first.
drop function public.qa_feed(uuid);

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
  is_published boolean
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
         q.is_published
  from public.questions q
  left join public.profiles asker on asker.id = q.asker_id
  left join public.profiles answerer on answerer.id = q.answered_by
  where q.church_id = p_church
    and public.is_church_member(p_church)
    and (
      q.is_published
      or public.is_church_leader(p_church)
      or (q.asker_id is not null and q.asker_id = auth.uid())
    )
  order by q.answered_at desc nulls last, q.asked_at desc
  limit 200;
$$;

-- A leader shares an answered question with the whole church, or makes it private again.
create function public.publish_question(p_question uuid, p_published boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.questions
  set is_published = p_published,
      published_at = case when p_published then now() end
  where id = p_question
    and public.is_church_member(church_id)
    and public.is_church_leader(church_id)
    and (not p_published or answer is not null);
  if not found then
    raise exception 'Answer the question first, then you can share it with everyone';
  end if;
end;
$$;

revoke execute on function public.qa_feed(uuid), public.publish_question(uuid, boolean) from public, anon;
grant execute on function public.qa_feed(uuid), public.publish_question(uuid, boolean) to authenticated;
