-- Reporting content.
--
-- Any approved member can report something they can see: a chat message, a private message they are in,
-- a message in an elders thread they can read, a prayer request, a question, a poll, a sermon, an event,
-- or another member. A report keeps a short copy of the reported text, so a reviewer can judge it even if it
-- is later deleted, and so leaders never need access to private conversations to review a report about one.
--
-- Who reviews:
--   'leaders'  - the church's Pastor, elders and admins, for reports about members and their content;
--   'platform' - the app's administrators, when the person reported is themselves a church leader, so leaders
--                never review reports about themselves.
-- Reporting is the only action here. Removing content uses the tools leaders already have.
--
-- The table is closed to direct access; everything goes through the functions below.

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in (
    'chat_message', 'private_message', 'elders_message', 'prayer_request', 'question', 'poll', 'sermon', 'event', 'member'
  )),
  target_id uuid not null,
  -- Whose content it is. Null when it cannot be traced to a person (an anonymous question) or the person has left.
  target_user_id uuid references public.profiles (id) on delete set null,
  reason text not null check (reason in ('inappropriate', 'harassment', 'spam', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  review_by text not null check (review_by in ('leaders', 'platform')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open report per person per item.
create unique index content_reports_one_open_per_reporter
  on public.content_reports (reporter_id, target_type, target_id) where status = 'open';
create index content_reports_church_idx on public.content_reports (church_id, status, created_at desc);

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;

-- Looks up what is being reported: its church, whose it is, a short copy of its text, and whether the caller may see it.
create function public.report_target(p_type text, p_id uuid, p_church uuid)
returns table (church_id uuid, author_id uuid, excerpt text, visible boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_type = 'chat_message' then
    return query select m.church_id, m.sender_id, left(m.body, 500), public.is_church_member(m.church_id)
      from public.church_chat_messages m where m.id = p_id;
  elsif p_type = 'private_message' then
    return query select c.church_id, m.sender_id, left(m.body, 500), public.is_conversation_participant(c.id)
      from public.messages m join public.conversations c on c.id = m.conversation_id where m.id = p_id;
  elsif p_type = 'elders_message' then
    return query select t.church_id, m.sender_id, left(m.body, 500), public.can_see_elder_thread(t.id)
      from public.elder_messages m join public.elder_threads t on t.id = m.thread_id where m.id = p_id;
  elsif p_type = 'prayer_request' then
    return query select r.church_id, r.author_id, left(r.body, 500), public.can_see_prayer(r.id)
      from public.prayer_requests r where r.id = p_id;
  elsif p_type = 'question' then
    return query select q.church_id, q.asker_id, left(q.body, 500),
      public.is_church_member(q.church_id) and (
        q.visibility = 'church'
        or (q.visibility = 'leaders' and public.is_church_leader(q.church_id))
        or public.has_church_role(q.church_id, array['pastor']::public.member_role[])
        or (q.asker_id is not null and q.asker_id = auth.uid())
      )
      from public.questions q where q.id = p_id;
  elsif p_type = 'poll' then
    return query select p.church_id, p.creator_id, left(p.question, 500), public.is_church_member(p.church_id)
      from public.polls p where p.id = p_id;
  elsif p_type = 'sermon' then
    return query select s.church_id, s.created_by, left(s.title || coalesce(': ' || s.body, ''), 500),
      public.is_church_member(s.church_id) and (
        (s.published and s.status = 'approved')
        or (s.created_by is not null and s.created_by = auth.uid())
        or public.has_church_role(s.church_id, array['pastor']::public.member_role[])
      )
      from public.sermons s where s.id = p_id;
  elsif p_type = 'event' then
    return query select e.church_id, e.created_by, left(e.title || coalesce(': ' || nullif(e.description, ''), ''), 500),
      public.is_church_member(e.church_id)
      from public.events e where e.id = p_id;
  elsif p_type = 'member' then
    -- The target is a person, who must belong to the church being reported in.
    return query select ms.church_id, ms.user_id, left(pr.full_name, 500), public.is_church_member(ms.church_id)
      from public.memberships ms join public.profiles pr on pr.id = ms.user_id
      where ms.user_id = p_id and ms.church_id = p_church and ms.status = 'approved';
  end if;
end;
$$;

revoke execute on function public.report_target(text, uuid, uuid) from public, anon, authenticated;

-- A member reports something they can see.
create function public.report_content(
  p_church uuid,
  p_type text,
  p_target uuid,
  p_reason text,
  p_details text default ''
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_target record;
  v_review text := 'leaders';
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.is_church_member(p_church) then
    raise exception 'Only members of this church can report' using errcode = '42501';
  end if;
  if p_reason not in ('inappropriate', 'harassment', 'spam', 'other') then
    raise exception 'Choose a reason';
  end if;
  if char_length(coalesce(p_details, '')) > 500 then
    raise exception 'Keep your note under 500 characters';
  end if;

  select * into v_target from public.report_target(p_type, p_target, p_church);
  if not found or v_target.church_id <> p_church or not v_target.visible then
    raise exception 'That isn''t available to report' using errcode = '42501';
  end if;
  if v_target.author_id is not null and v_target.author_id = auth.uid() then
    raise exception 'You can''t report your own content';
  end if;
  if (select count(*) from public.content_reports
      where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have sent a lot of reports today. Please try again tomorrow.';
  end if;

  -- Reports about a church leader go to the app's administrators, not to other leaders.
  if v_target.author_id is not null and exists (
    select 1 from public.memberships ms
    where ms.church_id = p_church and ms.user_id = v_target.author_id and ms.status = 'approved'
      and ms.role in ('pastor', 'elder', 'admin')
  ) then
    v_review := 'platform';
  end if;

  insert into public.content_reports (church_id, reporter_id, target_type, target_id, target_user_id, reason, details, excerpt, review_by)
  values (p_church, auth.uid(), p_type, p_target, v_target.author_id, p_reason, coalesce(p_details, ''), v_target.excerpt, v_review)
  on conflict (reporter_id, target_type, target_id) where status = 'open' do nothing;
end;
$$;

-- The open and recent reports a church's leaders review (reports about leaders are not in this list).
create function public.report_queue(p_church uuid)
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  details text,
  excerpt text,
  reporter_name text,
  author_name text,
  status text,
  resolution_note text,
  created_at timestamptz,
  church_name text
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.excerpt,
         rp.full_name, ap.full_name, r.status, r.resolution_note, r.created_at, c.name
  from public.content_reports r
  join public.churches c on c.id = r.church_id
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles ap on ap.id = r.target_user_id
  where r.church_id = p_church
    and r.review_by = 'leaders'
    and public.is_church_member(p_church)
    and public.is_church_leader(p_church)
  order by (r.status = 'open') desc, r.created_at desc
  limit 100;
$$;

-- The reports about church leaders, across all churches, for the app's administrators.
create function public.platform_report_queue()
returns table (
  id uuid,
  target_type text,
  target_id uuid,
  reason text,
  details text,
  excerpt text,
  reporter_name text,
  author_name text,
  status text,
  resolution_note text,
  created_at timestamptz,
  church_name text
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.target_type, r.target_id, r.reason, r.details, r.excerpt,
         rp.full_name, ap.full_name, r.status, r.resolution_note, r.created_at, c.name
  from public.content_reports r
  join public.churches c on c.id = r.church_id
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles ap on ap.id = r.target_user_id
  where r.review_by = 'platform'
    and public.is_platform_admin()
  order by (r.status = 'open') desc, r.created_at desc
  limit 100;
$$;

-- A reviewer closes a report: acted on (resolved) or no action needed (dismissed), with an optional note.
create function public.resolve_report(p_report uuid, p_dismiss boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_report public.content_reports;
begin
  select * into v_report from public.content_reports where id = p_report and status = 'open';
  if not found then
    raise exception 'This report is already closed or no longer exists';
  end if;
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Keep the note under 500 characters';
  end if;
  if not (
    (v_report.review_by = 'leaders' and public.is_church_member(v_report.church_id) and public.is_church_leader(v_report.church_id))
    or (v_report.review_by = 'platform' and public.is_platform_admin())
  ) then
    raise exception 'You can''t review this report' using errcode = '42501';
  end if;

  update public.content_reports
  set status = case when p_dismiss then 'dismissed' else 'resolved' end,
      resolution_note = nullif(trim(coalesce(p_note, '')), ''),
      resolved_by = auth.uid(),
      resolved_at = now()
  where id = p_report;
end;
$$;

revoke execute on function
  public.report_content(uuid, text, uuid, text, text),
  public.report_queue(uuid),
  public.platform_report_queue(),
  public.resolve_report(uuid, boolean, text)
from public, anon;

grant execute on function
  public.report_content(uuid, text, uuid, text, text),
  public.report_queue(uuid),
  public.platform_report_queue(),
  public.resolve_report(uuid, boolean, text)
to authenticated;
