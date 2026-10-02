-- Church features: the Pastor decides which features a church uses.
--
-- Every feature is off until the Pastor turns it on, for new and existing churches alike. A few things have no switch
-- because the church cannot work without them: Home, the member list, church settings, the More tab and SOS.
--
-- The list is kept in churches.enabled_features. Only a Pastor changes it, through set_church_features, which refuses
-- names it does not know. The app hides what is off (tiles, cards and tabs). Switching a feature off hides it; it does not
-- delete anything, so switching it back on brings everything back.
--
-- To give an existing church everything it had before, a platform admin can run, for that church:
--   update public.churches set enabled_features = public.known_church_features() where id = '<church id>';

create function public.known_church_features()
returns text[]
language sql immutable
as $$
  select array[
    'bible', 'videos', 'bible_study', 'sermons', 'qa', 'prayer', 'polls', 'daily_verse', 'reports',
    'special_days', 'funds', 'fundraisers', 'announcements', 'worship', 'calendar', 'chat', 'messages'
  ];
$$;

alter table public.churches
  add column enabled_features text[] not null default '{}'
  check (enabled_features <@ public.known_church_features());

-- Only the Pastor changes the list, and only through this function: the column is not in any update grant.
create function public.set_church_features(p_church uuid, p_features text[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_clean text[];
begin
  if not public.has_church_role(p_church, array['pastor']::public.member_role[]) then
    raise exception 'Only a Pastor can choose the features of the church' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(coalesce(p_features, '{}')) f where not (f = any (public.known_church_features()))) then
    raise exception 'That feature does not exist';
  end if;
  select coalesce(array_agg(distinct f order by f), '{}') into v_clean from unnest(coalesce(p_features, '{}')) f;
  update public.churches set enabled_features = v_clean where id = p_church;
end;
$$;

revoke all on function public.set_church_features(uuid, text[]) from public, anon;
grant execute on function public.set_church_features(uuid, text[]) to authenticated;

-- Make the new function visible to the API straight away.
notify pgrst, 'reload schema';
