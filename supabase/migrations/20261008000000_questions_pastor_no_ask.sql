-- The Pastor answers questions and controls who sees them; the Pastor does not ask them.
-- The app hides the ask box for the Pastor, and this makes the database refuse it too.

create or replace function public.ask_question(p_church uuid, p_body text, p_anonymous boolean default false)
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
  if public.has_church_role(p_church, array['pastor']::public.member_role[]) then
    raise exception 'The Pastor answers questions rather than asking them' using errcode = '42501';
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
