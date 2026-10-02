-- Bible quiz questions written by leaders.
--
-- The Pastor, elders and church admins (the leaders) write multiple-choice questions for the
-- church's kids and youth. A question can be planned for a week ("week_of", the Monday it features)
-- so the quiz stays fresh through the year; members only see a question from its week onward.
-- Questions with no week are always available. The app fills any gaps with questions it
-- generates itself, so no question bank is needed here.
--
-- Members can read the correct answer: this is a game with nothing at stake, and scores are not saved.

-- A check constraint cannot hold a subquery, so the rule for the choices lives in a function:
-- two to four choices, none missing or blank, none longer than 100 characters.
create function public.quiz_options_valid(p_options text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select cardinality(p_options) between 2 and 4
    and array_position(p_options, null) is null
    and not exists (
      select 1 from unnest(p_options) as o where char_length(trim(o)) not between 1 and 100
    );
$$;

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 200),
  options text[] not null check (public.quiz_options_valid(options)),
  -- Position of the right choice in options, counting from 0.
  correct_index smallint not null check (correct_index >= 0),
  explanation text not null default '' check (char_length(explanation) <= 300),
  -- Where to read it, like "John 3:16".
  reference text not null default '' check (char_length(reference) <= 60),
  level text not null check (level in ('little', 'kids', 'youth')),
  -- The Monday of the week this question features, or null for the general pool.
  week_of date,
  created_at timestamptz not null default now(),
  constraint quiz_questions_correct_index_valid check (correct_index < cardinality(options)),
  constraint quiz_questions_week_is_monday check (week_of is null or extract(isodow from week_of) = 1)
);

create index quiz_questions_church_week_idx on public.quiz_questions (church_id, week_of);

alter table public.quiz_questions enable row level security;
revoke all on public.quiz_questions from anon, authenticated;
grant select, insert, delete on public.quiz_questions to authenticated;

-- Dates have no time zone, so allow up to the furthest-ahead zone (UTC+14), as the daily verse does.
create policy "quiz_questions: members read what is due"
  on public.quiz_questions for select to authenticated
  using (
    public.is_church_member(church_id)
    and (week_of is null or week_of <= ((now() at time zone 'utc') + interval '14 hours')::date)
  );

create policy "quiz_questions: leaders read everything, including planned weeks"
  on public.quiz_questions for select to authenticated
  using (public.is_church_leader(church_id));

create policy "quiz_questions: leaders add in their own name"
  on public.quiz_questions for insert to authenticated
  with check (created_by = auth.uid() and public.is_church_leader(church_id));

create policy "quiz_questions: leaders delete"
  on public.quiz_questions for delete to authenticated
  using (public.is_church_leader(church_id));
