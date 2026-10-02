# MyChurch

A mobile app that helps church communities stay connected. One app serves many churches: a Pastor registers their church, we verify it, and members join with a code, an invite link, or by searching. Every church's people and content are kept separate from every other church's.

Built with [Expo](https://expo.dev) (React Native, TypeScript, Expo Router) and [Supabase](https://supabase.com) (Postgres, Auth, Storage).

See [PROGRESS.md](PROGRESS.md) for what's built and what's next.

## Seeing the app

You don't need Android Studio or Xcode.

1. Install [Node.js](https://nodejs.org) (the LTS version) on your computer.
2. Install **Expo Go** on your phone from the App Store or Google Play.
3. Set up Supabase (below), then in this folder run:

   ```bash
   npm install
   npx expo start
   ```

4. Scan the QR code it prints: with the Camera app on iPhone, or from inside Expo Go on Android. Your phone and computer need to be on the same Wi-Fi.

Press `w` in that terminal to open the app in a web browser instead. Android Studio is only needed if you want an Android emulator on your computer.

Push notifications don't work in Expo Go on Android, or anywhere until the app has an EAS project. Everything else does.

## Setting up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Run the database setup. Either paste `supabase/migrations/20260928000000_foundations.sql` into the project's SQL Editor and run it, or with the [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. Turn on email sign-in with a code: **Authentication → Sign In / Providers → Email** should be enabled. Then in **Authentication → Emails → Magic Link**, make sure the template includes `{{ .Token }}` so people receive a 6-digit code, for example:

   ```html
   <h2>Your MyChurch sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

   Supabase's built-in email sender only allows a few emails an hour. Before inviting a congregation, add your own SMTP provider under **Authentication → Emails → SMTP Settings**.

4. Copy `.env.example` to `.env` and fill in the project URL and publishable (anon) key from **Project Settings → API**.
5. Make yourself a platform admin so you can verify churches. Sign in to the app once, then run this in the SQL Editor with your email:

   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

## How it fits together

- `src/app/` holds the screens (Expo Router: every file is a route).
- `src/lib/` holds the Supabase client, sign-in, the active-church context and data hooks.
- `src/components/` holds shared UI.
- `supabase/migrations/` is the database: tables, row level security, and the functions the app calls to register, join, approve and change roles.
- `supabase/tests/` checks the database rules, above all that one church can never read another's data.

**Who can do what** is enforced in the database, not just hidden in the app:

| Role | Can |
|---|---|
| Pastor | Everything below, plus change roles, church settings and the join code |
| Elder | Approve and remove members, see the join code, edit or delete any calendar event |
| Church admin | Church settings, approve members, join code, edit or delete any calendar event |
| Member | See the church and its directory, add calendar events, edit or delete their own, send private messages to other members |
| Pending | See only their own request until approved |
| Platform admin | Verify or suspend churches; can't see any church's members or content |

A church always keeps at least one Pastor.

## Store release

- **Privacy policy and terms** live in `src/lib/legal.json`. The app shows them, and `npm run build:legal` turns the same text into web pages in `docs/` (publish that folder, for example with GitHub Pages, and give the store listings the address of `docs/privacy.html`). Set `supportEmail` in that file before publishing. The text is a starting point; have it reviewed.
- **Reporting** uses the `content_reports` table and functions (migration `20261010000000_content_reports.sql`). Church leaders review reports about members in the Reports tile on Home; reports about leaders go to platform admins.
- **Account deletion** is the `delete-account` edge function. Deploy it with `npx supabase functions deploy delete-account --project-ref <ref>`.
- **Features chosen by the Pastor.** Every feature (the Home tiles, the Home cards, and the Calendar, Chat and Messages tabs) is off until the Pastor turns it on in Church settings, for every church, new or old. Members, church settings, SOS and the More tab are always on. Switching a feature off only hides it in the app; nothing is deleted. It does not stop push notifications for it. Run migration `20261023000000_church_features.sql`. Existing churches start with everything off; to give one its old features, run `update public.churches set enabled_features = public.known_church_features() where id = '<church id>';`.
- **Sunday worship.** The Pastor, elders and anyone the Pastor switches on as a Worship leader (a switch on the member screen, not a role) plan the Psalm and up to 12 songs for a Sunday, with a link to listen to each. Planning is in the Worship Planner tile. Members see the plan on a Home card and under Worship on Sunday until 6 PM, and can open the Psalm in the Bible. Songs planned are kept in the church's own song library (language, tags, when last sung and how often), so planners can add them again; only planners can see the library. Run migrations `20261021000000_worship_plans.sql` and `20261022000000_song_library.sql`.
- **Fundraisers.** The Pastor and elders open a fundraiser for a cause (a new building, say), with an optional target, and record the money as it arrives. Members say how much they can give (a pledge, not a payment) and each pledge counts towards the total at once; everyone sees a progress bar with what is left. Members only ever see totals; only the Pastor and elders see who gave and who pledged. It is separate from the funds ledger. Run migration `20261020000000_fundraisers.sql` (it needs the funds migrations first).
- **SOS alerts.** Any member can hold the SOS button for 3 seconds, then has 5 seconds to cancel, and the whole church is alerted with a loud push notification and a red banner on Home, with the sender's location, refreshed while their app is open (no background tracking). The sender taps I am safe, a leader can end an alert, and after 2 hours it ends by itself; the location is erased when it ends and a record without coordinates stays for 30 days for the Pastor and elders (SOS history). Limit of 3 alerts per person per day. It is not a replacement for the emergency services. Run migration `20261019000000_sos_alerts.sql`, deploy `send-sos-alert`, and build a new app version (it adds `expo-location` and the iOS Time Sensitive notifications capability, which must also be enabled on the app id in the Apple developer account). Before release, update the Google Play data safety form and Apple privacy labels for approximate and precise location, and have the privacy policy section on SOS reviewed.
- **Chat groups.** The church chat is now called General. The Pastor and elders can add groups for committees and fellowships (Chat tab, Groups), choose who is in each, and only those people can read or write in it, not even the Pastor if they are not a member. Run migration `20261018000000_chat_groups.sql`.
- **Church funds.** A ledger the Pastor and elders keep by hand (opening balance plus entries, with a log of every change); nothing connects to a bank. Run migration `20261016000000_church_funds.sql`. Only the Pastor and elders can read it, enforced by row level security.
- **Church videos.** The Pastor pastes the church's YouTube channel in Church settings; members see its latest 15 videos under Videos. No YouTube API key is needed. Run migrations `20261014000000_church_youtube.sql` and `20261015000000_video_notifications.sql`, then deploy `set-youtube-channel`, `church-videos` and `notify-new-videos` with `npx supabase functions deploy <name> --project-ref <ref>`. To send a push notification for each new upload, run `supabase/scheduled/notify-new-videos.sql` once in the SQL Editor (it needs the `pg_cron` and `pg_net` extensions and your project's values).

## Building the app with EAS

`eas.json` has two build profiles: **preview** (an Android .apk you install directly on test phones) and **production** (what goes to the stores). Run EAS with `npx eas-cli@latest`.

1. **Sign in and create the project:** `npx eas-cli@latest login`, then `npx eas-cli@latest init`. That writes the project id into `app.json`, which is what makes push notifications work on real phones.
2. **Choose the app identifiers** (permanent once published) and add them to `app.json`: `expo.ios.bundleIdentifier` and `expo.android.package`, for example `com.yourname.mychurch`.
3. **Give the cloud builds the Supabase settings.** `.env` is not uploaded to EAS, so set the two public values for each environment you build (use `preview` and `production`):
   ```
   npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://<project>.supabase.co --environment preview --visibility plaintext
   npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_KEY --value <the publishable key> --environment preview --visibility plaintext
   ```
   Repeat with `--environment production`.
4. **Push notifications on Android** need a Firebase service account key uploaded to EAS (`npx eas-cli@latest credentials`); see Expo's "Add Android FCM V1 credentials" guide. On iOS, EAS creates the push key for you the first time you build, if you have an Apple Developer account.
5. **Build a test app:** `npx eas-cli@latest build --platform android --profile preview`, then install the .apk from the link EAS gives you.
6. **Build for the stores:** `npx eas-cli@latest build --platform all --profile production`, then `npx eas-cli@latest submit`.

The app icon, Android adaptive icon and splash screen in `assets/images/` are **plain placeholders** (a white cross on the app's blue). Replace them with the real logo before the store listing: a 1024x1024 square PNG with no transparency for `icon.png`, and matching foreground, monochrome and splash images.

## Checks

```bash
npx tsc --noEmit       # types
npx expo lint          # lint
npm run test:db        # database rules (needs Postgres 15+ installed locally)
```

**Running the database tests on Windows:** install Postgres 15 or newer (for example `winget install PostgreSQL.PostgreSQL.16`; you only need the programs, not a running server) and run `npm run test:db` from **Git Bash**. The script finds Postgres under `C:\Program Files\PostgreSQL\<version>\bin`; if yours is elsewhere, point it there: `TEST_DB_PGBIN='/c/path/to/bin' npm run test:db`. It starts its own temporary server on port 54329 and removes it afterwards. On Linux and macOS it works the same way, and `.gitattributes` keeps the script's Unix line endings.

## Roadmap

The full plan is in [PROGRESS.md](PROGRESS.md). In short: announcements, a daily verse chosen by the Pastor, sermon videos and the church calendar come next; then messaging (including anonymous messages to the Pastor) and prayer requests; then polls, Q&A and the photo album; then the store release.

**Future builds, after the first release:** fundraising and giving with Stripe Connect, where each church connects its own Stripe account and donations go straight to that church. It was left out of the first release on purpose; the data model leaves room for it.
