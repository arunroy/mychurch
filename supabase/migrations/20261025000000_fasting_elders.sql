-- Elders can also manage the fasting prayer day (which Friday, the times and the breaks), not only the Pastor.

drop policy "fasting_settings: the Pastor sets up" on public.fasting_settings;
drop policy "fasting_settings: the Pastor changes" on public.fasting_settings;

create policy "fasting_settings: the Pastor and elders set up"
  on public.fasting_settings for insert to authenticated
  with check (public.has_church_role(church_id, array['pastor', 'elder']::public.member_role[]));
create policy "fasting_settings: the Pastor and elders change"
  on public.fasting_settings for update to authenticated
  using (public.has_church_role(church_id, array['pastor', 'elder']::public.member_role[]))
  with check (public.has_church_role(church_id, array['pastor', 'elder']::public.member_role[]));
