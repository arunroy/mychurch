-- Sermons from members and from outside the church, reviewed by the Pastor.
--
-- Every sermon now has a source:
--   'pastor'   - the church's own sermons. Only the Pastor adds them, and they publish at once.
--   'member'   - an article or short sermon a member wrote (the text is kept here).
--   'external' - a link to a sermon from elsewhere that someone found worth sharing. No text of the
--                sermon is kept: just a title, who it is by, the link and a short note on why.
--
-- Member and external entries start as 'pending'. Until the Pastor approves one, only its author and
-- the Pastor can see it; after approval every member can. The Pastor can decline with a short note.
-- Editing an entry sends it back to 'pending'. (The Pastor's own additions need no review.)
--
-- Members add and edit through the functions below, so the review rule cannot be skipped.

alter table public.sermons
  add column source text not null default 'pastor' check (source in ('pastor', 'member', 'external')),
  add column body text check (body is null or char_length(trim(body)) between 1 and 8000),
  add column status text not null default 'approved' check (status in ('pending', 'approved', 'declined')),
  add column review_note text check (review_note is null or char_length(review_note) <= 500),
  add column reviewed_at timestamptz;

-- A sermon needs something to read or watch: text, or a link.
alter table public.sermons drop constraint sermons_has_link;
alter table public.sermons
  add constraint sermons_has_content check (read_url is not null or media_url is not null or body is not null),
  add constraint sermons_member_has_text check (source <> 'member' or body is not null),
  add constraint sermons_external_has_link check (source <> 'external' or read_url is not null),
  add constraint sermons_external_note_short check (source <> 'external' or body is null or char_length(body) <= 500);

-- ---------------------------------------------------------------------------
-- Who can read and write the table directly
-- ---------------------------------------------------------------------------

drop policy "sermons: members read the published ones" on public.sermons;
drop policy "sermons: leaders read everything, drafts included" on public.sermons;
drop policy "sermons: leaders add in their own name" on public.sermons;
drop policy "sermons: leaders edit" on public.sermons;
drop policy "sermons: leaders remove" on public.sermons;

create policy "sermons: members read what is approved and published"
  on public.sermons for select to authenticated
  using (published and status = 'approved' and public.is_church_member(church_id));

create policy "sermons: authors read their own"
  on public.sermons for select to authenticated
  using (created_by = auth.uid() and public.is_church_member(church_id));

create policy "sermons: the Pastor reads everything"
  on public.sermons for select to authenticated
  using (public.has_church_role(church_id, array['pastor']::public.member_role[]));

create policy "sermons: the Pastor adds the church's own"
  on public.sermons for insert to authenticated
  with check (
    created_by = auth.uid()
    and source = 'pastor'
    and status = 'approved'
    and public.has_church_role(church_id, array['pastor']::public.member_role[])
  );

create policy "sermons: the Pastor edits the church's own"
  on public.sermons for update to authenticated
  using (source = 'pastor' and public.has_church_role(church_id, array['pastor']::public.member_role[]))
  with check (source = 'pastor' and public.has_church_role(church_id, array['pastor']::public.member_role[]));

create policy "sermons: the Pastor removes any, authors remove their own submissions"
  on public.sermons for delete to authenticated
  using (
    public.has_church_role(church_id, array['pastor']::public.member_role[])
    or (created_by = auth.uid() and source <> 'pastor' and public.is_church_member(church_id))
  );

grant update (body) on public.sermons to authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Checks the fields shared by adding and editing a submission.
create function public.check_sermon_fields(p_source text, p_title text, p_speaker text, p_body text, p_url text)
returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 150 then
    raise exception 'Give it a title of up to 150 characters';
  end if;
  if char_length(coalesce(p_speaker, '')) > 100 then
    raise exception 'Keep the name under 100 characters';
  end if;
  if p_source = 'member' then
    if char_length(trim(coalesce(p_body, ''))) not between 1 and 8000 then
      raise exception 'Write between 1 and 8000 characters';
    end if;
  else
    if p_url is null or p_url !~ '^https?://' or char_length(p_url) > 500 then
      raise exception 'Add a link that starts with https://';
    end if;
    if char_length(coalesce(p_body, '')) > 500 then
      raise exception 'Keep the note under 500 characters';
    end if;
  end if;
end;
$$;

revoke execute on function public.check_sermon_fields(text, text, text, text, text) from public, anon, authenticated;

-- A member writes an article (source 'member') or suggests an external sermon (source 'external').
-- It waits for the Pastor's review; the Pastor's own additions are approved at once.
create function public.submit_sermon(
  p_church uuid,
  p_source text,
  p_title text,
  p_speaker text,
  p_reference text,
  p_book text,
  p_chapter integer,
  p_verse_start integer,
  p_verse_end integer,
  p_body text,
  p_url text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_pastor boolean;
  v_waiting integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if not public.is_church_member(p_church) then
    raise exception 'Only members of this church can add a sermon' using errcode = '42501';
  end if;
  if p_source not in ('member', 'external') then
    raise exception 'Choose an article or an external sermon';
  end if;
  perform public.check_sermon_fields(p_source, p_title, p_speaker, p_body, p_url);

  v_pastor := public.has_church_role(p_church, array['pastor']::public.member_role[]);
  select count(*) into v_waiting from public.sermons
  where church_id = p_church and created_by = auth.uid() and status = 'pending';
  if not v_pastor and v_waiting >= 5 then
    raise exception 'You already have 5 waiting for the Pastor to review. Please wait for those first.';
  end if;

  insert into public.sermons (
    church_id, created_by, title, speaker, sermon_date, reference, book, chapter, verse_start, verse_end,
    source, body, read_url, status, reviewed_at
  )
  values (
    p_church, auth.uid(), trim(p_title), trim(coalesce(p_speaker, '')), current_date,
    coalesce(p_reference, ''), p_book, p_chapter, p_verse_start, p_verse_end,
    p_source, nullif(trim(coalesce(p_body, '')), ''), case when p_source = 'external' then p_url end,
    case when v_pastor then 'approved' else 'pending' end,
    case when v_pastor then now() end
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- The author changes their submission. It goes back to waiting for review (unless the author is the Pastor).
create function public.edit_submission(
  p_sermon uuid,
  p_title text,
  p_speaker text,
  p_reference text,
  p_book text,
  p_chapter integer,
  p_verse_start integer,
  p_verse_end integer,
  p_body text,
  p_url text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.sermons;
  v_pastor boolean;
begin
  select * into v_row from public.sermons where id = p_sermon;
  if not found or v_row.created_by is distinct from auth.uid() or v_row.source = 'pastor'
     or not public.is_church_member(v_row.church_id) then
    raise exception 'You can''t change this' using errcode = '42501';
  end if;
  perform public.check_sermon_fields(v_row.source, p_title, p_speaker, p_body, p_url);

  v_pastor := public.has_church_role(v_row.church_id, array['pastor']::public.member_role[]);
  update public.sermons
  set title = trim(p_title),
      speaker = trim(coalesce(p_speaker, '')),
      reference = coalesce(p_reference, ''),
      book = p_book,
      chapter = p_chapter,
      verse_start = p_verse_start,
      verse_end = p_verse_end,
      body = nullif(trim(coalesce(p_body, '')), ''),
      read_url = case when v_row.source = 'external' then p_url end,
      status = case when v_pastor then 'approved' else 'pending' end,
      review_note = null,
      reviewed_at = case when v_pastor then now() end,
      updated_at = now()
  where id = p_sermon;
end;
$$;

-- The Pastor approves or declines a submission, with an optional note the author sees.
create function public.review_sermon(p_sermon uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Keep the note under 500 characters';
  end if;
  update public.sermons
  set status = case when p_approve then 'approved' else 'declined' end,
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_at = now()
  where id = p_sermon
    and source <> 'pastor'
    and public.is_church_member(church_id)
    and public.has_church_role(church_id, array['pastor']::public.member_role[]);
  if not found then
    raise exception 'Only the Pastor can review this' using errcode = '42501';
  end if;
end;
$$;

-- The list. Everyone gets the approved, published sermons; authors also get their own; the Pastor gets everything.
-- The text itself is left out (it can be long); the detail function returns it.
create function public.sermon_feed(p_church uuid)
returns table (
  id uuid,
  source text,
  title text,
  speaker text,
  sermon_date date,
  reference text,
  status text,
  published boolean,
  has_text boolean,
  author_name text,
  is_mine boolean,
  review_note text
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.source, s.title, s.speaker, s.sermon_date, s.reference, s.status, s.published,
         s.body is not null,
         case when s.source <> 'pastor' then p.full_name end,
         s.created_by is not null and s.created_by = auth.uid(),
         s.review_note
  from public.sermons s
  left join public.profiles p on p.id = s.created_by
  where s.church_id = p_church
    and public.is_church_member(p_church)
    and (
      (s.published and s.status = 'approved')
      or (s.created_by is not null and s.created_by = auth.uid())
      or public.has_church_role(p_church, array['pastor']::public.member_role[])
    )
  order by s.sermon_date desc, s.created_at desc
  limit 300;
$$;

-- One sermon in full, under the same visibility rules as the list.
create function public.sermon_detail(p_sermon uuid)
returns table (
  id uuid,
  church_id uuid,
  source text,
  title text,
  speaker text,
  sermon_date date,
  reference text,
  book text,
  chapter integer,
  verse_start integer,
  verse_end integer,
  body text,
  read_url text,
  media_url text,
  published boolean,
  status text,
  review_note text,
  reviewed_at timestamptz,
  author_name text,
  is_mine boolean
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.church_id, s.source, s.title, s.speaker, s.sermon_date, s.reference, s.book, s.chapter,
         s.verse_start, s.verse_end, s.body, s.read_url, s.media_url, s.published, s.status, s.review_note,
         s.reviewed_at,
         case when s.source <> 'pastor' then p.full_name end,
         s.created_by is not null and s.created_by = auth.uid()
  from public.sermons s
  left join public.profiles p on p.id = s.created_by
  where s.id = p_sermon
    and public.is_church_member(s.church_id)
    and (
      (s.published and s.status = 'approved')
      or (s.created_by is not null and s.created_by = auth.uid())
      or public.has_church_role(s.church_id, array['pastor']::public.member_role[])
    );
$$;

revoke execute on function
  public.submit_sermon(uuid, text, text, text, text, text, integer, integer, integer, text, text),
  public.edit_submission(uuid, text, text, text, text, integer, integer, integer, text, text),
  public.review_sermon(uuid, boolean, text),
  public.sermon_feed(uuid),
  public.sermon_detail(uuid)
from public, anon;

grant execute on function
  public.submit_sermon(uuid, text, text, text, text, text, integer, integer, integer, text, text),
  public.edit_submission(uuid, text, text, text, text, integer, integer, integer, text, text),
  public.review_sermon(uuid, boolean, text),
  public.sermon_feed(uuid),
  public.sermon_detail(uuid)
to authenticated;
