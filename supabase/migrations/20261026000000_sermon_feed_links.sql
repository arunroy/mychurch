-- The sermon list now carries each sermon's links, so the app can open a linked sermon straight from the list and
-- label it with the site it comes from (SermonCentral, YouTube, ...). Same visibility rules as before.

drop function public.sermon_feed(uuid);

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
  review_note text,
  read_url text,
  media_url text
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.source, s.title, s.speaker, s.sermon_date, s.reference, s.status, s.published,
         s.body is not null,
         case when s.source <> 'pastor' then p.full_name end,
         s.created_by is not null and s.created_by = auth.uid(),
         s.review_note,
         s.read_url,
         s.media_url
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

revoke execute on function public.sermon_feed(uuid) from public, anon;
grant execute on function public.sermon_feed(uuid) to authenticated;

notify pgrst, 'reload schema';
