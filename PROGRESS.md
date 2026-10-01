# Progress

## Decisions

- **Expo** (managed workflow, Expo Router, TypeScript) with **Supabase** as the backend.
- **One app for many churches.** Nothing church-specific is built in. Each church sets its own name, colour, logo and (later) YouTube channel.
- **Churches are verified** by a platform admin before anyone can join them.
- **Roles are per church:** Pastor, Elder, Church admin, Member, and Pending until approved. One person can belong to several churches.
- **The Pastor chooses the daily verse** (no automatic reading plan).
- **No payments in the first release.** Fundraising is a future build (see below).
- **Sign-in is by email code**, no passwords.

## Phases

### Phase 0: Foundations ✅ built, not yet run against a live Supabase project

- [x] Expo app scaffold (SDK 57)
- [x] Database: churches, profiles, memberships, join codes, push tokens, platform admins
- [x] Row level security on every table, with church separation tests (53 checks)
- [x] Sign in with an emailed 6-digit code
- [x] First-time name entry
- [x] Register a church (becomes its Pastor; church waits for verification)
- [x] Platform admin screen to verify or suspend churches
- [x] Join by code, by invite link (the code survives sign-in), or search and ask to join
- [x] Waiting screen for pending members and unverified churches
- [x] Members list with approve / decline, leaders and members sections, search
- [x] Member detail: change role (Pastor only), remove; a church always keeps a Pastor
- [x] Invite card: share invite, copy code, make a new code
- [x] Church settings: logo, name, city, contact email, colour, approval on/off, directory on/off
- [x] Profile: photo, name, show or hide yourself in the directory
- [x] Switch between churches
- [x] Theme: choose System, Light or Dark in More; remembered on the device
- [x] UI revamp: theme settings with 12 matched themes (background gradient, text and accent colours checked for contrast, light and dark) plus plain, a bigger bottom menu with icons and badges, church features (members, prayer, polls, daily verse, announcements, settings) as tiles on Home
- [x] Push token registration (sending comes with announcements)
- [ ] Create the Supabase project and run the migration
- [ ] Try it end to end on a phone with two test churches

### Phase 1: The Pastor's voice

- [x] Announcements: the Pastor, elders and admins post notices (optional expiry) that show on everyone's Home screen
- [x] Announcement push notifications (sent when a leader posts, if they leave "Send a notification" on; needs an EAS project and a real phone)
- [x] Daily verse: Pastor picks translation, book, chapter and verses (no typing or pasting; the save-daily-verse function fetches and stores the text); reflection; schedule ahead
- [x] Sermons: leaders add a sermon with links to read it (for example on SermonCentral) and/or watch or listen; drafts, scripture, search. The app stores no sermon text, because SermonCentral has no API and its terms do not allow republishing
- [x] Church calendar: a shared Calendar tab; any member adds events, only the creator or a leader edits or deletes
- [x] Calendar extras: Going / Maybe / Can't go with totals (names for the event's creator and leaders), a reminder on this phone, add to the phone's calendar, and date and time pickers on the event, verse and sermon forms

### Phase 2: Connection

- [x] Private messages: any member can message any other member, including the Pastor; live while the chat is open; only the two people can read it
- [x] Church chat: a public room in its own Chat tab; every approved member reads and posts, authors and leaders remove messages; Members moved into More; unread badge on the Chat tab
- [x] Message notifications: a push when a private message arrives, and when the elders write or reply; tapping opens the conversation (needs an EAS project and a real phone)
- [x] Message the elders: a shared inbox; a member writes once, every leader can read and reply under their own name
- [x] Anonymous messages to the Pastor: no sender stored, day-only dates, a daily limit kept apart from the messages, and an optional reply code
- [x] Prayer requests: share with the church, leaders or the Pastor only; "I prayed" counts; authors mark them answered

### Phase 3: Engagement

- [x] Polls: any member starts one (single or multiple choice, optional closing time); votes are private; results show after you vote or when it closes
- [x] Q&A: members ask (anonymous questions store nothing about the asker); a question is private to the Pastor until they answer it and choose who sees it: only them, the church leaders, or the whole church
- [ ] Church photo album with elder approval

### Phase 4: Store release

- [ ] EAS project, app icons and splash in MyChurch branding
- [ ] Optional "tap to sign in" link in the sign-in email alongside the code (needs universal links / app links on a domain we control)
- [ ] Privacy policy and terms
- [ ] Report content, account deletion (both stores require these)
- [ ] App Store and Google Play listings

## Future builds

### Fundraising and giving

Left out of the first release on purpose.

- **What:** campaigns with a goal, description, image and progress bar. A Give button opens Stripe Checkout in the browser.
- **How:** Stripe Connect. Each church connects its own Stripe account from settings, so donations go straight to that church and never pass through the platform. Checkout runs in the browser, which keeps card details out of the app and fits App Store and Google Play donation rules. Progress updates from Stripe webhooks.
- **Data:** `stripe_account_id` on `churches`; new `fundraisers` and `donations` tables with `church_id` and the same row level security as everything else. Pastors and elders create campaigns; a church can't create one until Stripe is connected.
- **Before starting:** a Stripe platform account and business details for whoever runs MyChurch, and a decision on any platform fee (default: none).
