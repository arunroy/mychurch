-- Run this ONCE in the Supabase SQL Editor to check for new church videos every 15 minutes.
-- It is not a migration, because it holds values that belong to your project.
--
-- Before running it:
--   1. Deploy the function:   npx supabase functions deploy notify-new-videos --project-ref <ref>
--   2. Turn on the extensions (Dashboard > Database > Extensions): pg_cron and pg_net.
--   3. Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> below (Dashboard > Project Settings > API).
--      The service role key is a secret: only paste it into this SQL Editor, never into the app or git.

select cron.schedule(
  'notify-new-videos',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-new-videos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- To see it running:    select * from cron.job_run_details order by start_time desc limit 5;
-- To stop it:           select cron.unschedule('notify-new-videos');
