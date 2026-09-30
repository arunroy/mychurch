-- Announcements now go out through the post-announcement function, which saves the notice and
-- sends the push notification in one step (service role). Signed-in users can no longer insert
-- announcements directly, so a notice can't be posted without the function's leader check.
-- Reading and removing work as before.

drop policy "announcements: leaders post in their own name" on public.announcements;
revoke insert on public.announcements from authenticated;
