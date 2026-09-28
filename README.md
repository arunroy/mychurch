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
| Elder | Approve and remove members, see the join code |
| Church admin | Church settings, approve members, join code |
| Member | See the church and its directory |
| Pending | See only their own request until approved |
| Platform admin | Verify or suspend churches; can't see any church's members or content |

A church always keeps at least one Pastor.

## Checks

```bash
npx tsc --noEmit       # types
npx expo lint          # lint
npm run test:db        # database rules (needs Postgres 15+ installed locally)
```

## Roadmap

The full plan is in [PROGRESS.md](PROGRESS.md). In short: announcements, a daily verse chosen by the Pastor, sermon videos and the church calendar come next; then messaging (including anonymous messages to the Pastor) and prayer requests; then polls, Q&A and the photo album; then the store release.

**Future builds, after the first release:** fundraising and giving with Stripe Connect, where each church connects its own Stripe account and donations go straight to that church. It was left out of the first release on purpose; the data model leaves room for it.
