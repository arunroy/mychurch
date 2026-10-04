-- A photo of the church for the top of Home. Stored in the church-logos bucket under the church's own folder, which
-- the Pastor and church admins can already upload to; they set it like the logo.

alter table public.churches add column banner_path text check (char_length(banner_path) <= 300);

grant update (banner_path) on public.churches to authenticated;

notify pgrst, 'reload schema';
