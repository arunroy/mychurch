// Types for the Supabase schema in supabase/migrations.
// Once a Supabase project exists this file can be regenerated with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type ChurchStatus = 'pending' | 'active' | 'suspended';
export type MemberRole = 'pastor' | 'elder' | 'admin' | 'member';
export type MembershipStatus = 'pending' | 'approved';

type Relationship<Name extends string, Column extends string, Target extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ['id'];
};

type Table<Row, Insert, Update, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type Profile = {
  id: string;
  full_name: string;
  avatar_path: string | null;
  /** Month and day only, never the year. Both are set together or both are null. */
  birth_month: number | null;
  birth_day: number | null;
  created_at: string;
};

export type SpecialDayKind = 'birthday' | 'anniversary';

/** A date leaders added to the church's list. */
export type SpecialDay = {
  id: string;
  church_id: string;
  kind: SpecialDayKind;
  name: string;
  month: number;
  day: number;
  /** Anniversaries only, so Home can say how many years. */
  year: number | null;
  created_by: string;
  created_at: string;
};

/** One row of the church's combined list: leader-added ('added') or a member's own birthday ('member'). */
export type SpecialDayEntry = {
  id: string;
  source: 'added' | 'member';
  kind: SpecialDayKind;
  name: string;
  month: number;
  day: number;
  year: number | null;
  user_id: string | null;
  avatar_path: string | null;
};

/** A person's private note on one verse. It follows the verse, not the translation. */
export type BibleNote = {
  id: string;
  user_id: string;
  book: string;
  chapter: number;
  verse: number;
  body: string;
  created_at: string;
  updated_at: string;
};

/** The church's funds settings. Only the Pastor and elders can read or change them. */
export type ChurchFunds = {
  church_id: string;
  /** ISO 4217 code, like INR or GBP. */
  currency: string;
  opening_balance: number;
  opening_date: string;
  /** A short note like "Federal Bank ••1234". Never a full account number. */
  account_label: string;
  updated_by: string | null;
  updated_at: string;
};

/** One entry in the church's ledger. Money in is positive and money out is negative. */
export type FundTransaction = {
  id: string;
  church_id: string;
  occurred_on: string;
  description: string;
  note: string;
  amount: number;
  /** Who the money came from (or was paid to). The name stays on the entry even after a member leaves. */
  party_name: string;
  party_user_id: string | null;
  source: 'manual' | 'bank';
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
};

export type FundTransactionWithPeople = FundTransaction & {
  adder: { full_name: string } | null;
  editor: { full_name: string } | null;
};

export type FundsSummary = {
  currency: string;
  account_label: string;
  opening_balance: number;
  opening_date: string;
  balance: number;
  transaction_count: number;
  latest_on: string | null;
};

/** A cause the church is raising money for. */
export type Fundraiser = {
  id: string;
  church_id: string;
  title: string;
  description: string;
  /** Null when there is no target, so no bar is drawn. */
  target_amount: number | null;
  currency: string;
  status: 'active' | 'closed';
  created_by: string | null;
  created_at: string;
};

/** Money received (entered by a leader) or a pledge (entered by the member). Only the Pastor and elders can read these. */
export type FundraiserEntry = {
  id: string;
  fundraiser_id: string;
  church_id: string;
  kind: 'received' | 'pledge';
  amount: number;
  party_name: string;
  party_user_id: string | null;
  occurred_on: string;
  note: string;
  created_by: string | null;
  created_at: string;
};

/** What every member sees of a fundraiser: totals, and their own pledge. Never a name. */
export type FundraiserSummary = Pick<
  Fundraiser,
  'id' | 'title' | 'description' | 'target_amount' | 'currency' | 'status' | 'created_at'
> & {
  received_total: number;
  pledged_total: number;
  my_pledge: number | null;
};

/** The Psalm and songs for one Sunday. The Psalm is optional; its book is always Psalms. */
export type WorshipPlan = {
  id: string;
  church_id: string;
  /** The Sunday, as YYYY-MM-DD. */
  service_date: string;
  psalm_chapter: number | null;
  psalm_verse_start: number | null;
  psalm_verse_end: number | null;
  /** Like "Psalm 23:1-6", or empty. */
  psalm_reference: string;
  note: string;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type WorshipSong = {
  id: string;
  plan_id: string;
  church_id: string;
  position: number;
  title: string;
  artist: string;
  /** A web link to listen to, or empty. */
  link: string;
  /** The library entry this song came from. Empty if that was deleted. */
  song_id: string | null;
};

export type SongLanguage = 'en' | 'hi' | 'ta' | 'ml' | 'kn' | 'other';

/** A song in the church's own library. Only the people who can plan worship can read these. */
export type ChurchSong = {
  id: string;
  church_id: string;
  title: string;
  artist: string;
  link: string;
  language: SongLanguage;
  /** Up to five lower-case tags. */
  tags: string[];
  created_by: string | null;
  created_at: string;
};

/** A library song with how often and when it was sung, worked out from the plans. */
export type SongLibraryEntry = Pick<ChurchSong, 'id' | 'title' | 'artist' | 'link' | 'language' | 'tags'> & {
  times_sung: number;
  /** The most recent Sunday it was planned for, up to today. */
  last_sung: string | null;
  /** The next Sunday it is planned for, after today. */
  next_planned: string | null;
};

export type QuizLevel = 'little' | 'kids' | 'youth';

/** A multiple-choice question a leader wrote. */
export type QuizQuestion = {
  id: string;
  church_id: string;
  created_by: string;
  question: string;
  /** Two to four choices. */
  options: string[];
  /** Position of the right choice in options, counting from 0. */
  correct_index: number;
  explanation: string;
  reference: string;
  level: QuizLevel;
  /** The Monday of the week it features; null means the general pool. */
  week_of: string | null;
  created_at: string;
};

export type Church = {
  id: string;
  name: string;
  city: string;
  contact_email: string;
  accent_color: string;
  logo_path: string | null;
  status: ChurchStatus;
  requires_approval: boolean;
  directory_enabled: boolean;
  /** What the Pastor pasted, and the channel it was resolved to. Set only by the set-youtube-channel function. */
  youtube_url: string | null;
  youtube_channel_id: string | null;
  /** The newest video members were told about; set only by the functions. */
  youtube_last_video_id: string | null;
  youtube_last_published_at: string | null;
  created_by: string | null;
  created_at: string;
  verified_at: string | null;
};

export type Membership = {
  church_id: string;
  user_id: string;
  role: MemberRole;
  status: MembershipStatus;
  directory_visible: boolean;
  /** Can plan Sunday worship, besides the Pastor and elders. Set by the Pastor. */
  is_worship_leader: boolean;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};

export type ChurchJoinCode = {
  church_id: string;
  code: string;
  updated_at: string;
};

export type PushToken = {
  token: string;
  user_id: string;
  platform: 'ios' | 'android' | 'web';
  updated_at: string;
};

export type DailyVerse = {
  church_id: string;
  verse_date: string;
  reference: string;
  verse_text: string;
  translation: string;
  reflection: string;
  /** Set when the verse was picked; rows from before the picker have none of these. */
  book: string | null;
  chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
  translation_code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ChurchEvent = {
  id: string;
  church_id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ReportTargetType =
  | 'chat_message'
  | 'private_message'
  | 'elders_message'
  | 'prayer_request'
  | 'question'
  | 'poll'
  | 'sermon'
  | 'event'
  | 'member';

export type ReportReason = 'inappropriate' | 'harassment' | 'spam' | 'other';

/** A report as a reviewer sees it. `excerpt` is a short copy of the reported text. */
export type ReportItem = {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details: string;
  excerpt: string;
  reporter_name: string | null;
  author_name: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  resolution_note: string | null;
  created_at: string;
  church_name: string;
};

export type SermonSource = 'pastor' | 'member' | 'external';
export type SermonStatus = 'pending' | 'approved' | 'declined';

/** One row of the sermon list. The text itself is left out; `SermonDetail` has it. */
export type SermonItem = {
  id: string;
  source: SermonSource;
  title: string;
  speaker: string;
  sermon_date: string;
  reference: string;
  status: SermonStatus;
  published: boolean;
  has_text: boolean;
  /** Who wrote or shared it. Null for the Pastor's own sermons. */
  author_name: string | null;
  is_mine: boolean;
  review_note: string | null;
};

export type SermonDetail = {
  id: string;
  church_id: string;
  source: SermonSource;
  title: string;
  speaker: string;
  sermon_date: string;
  reference: string;
  book: string | null;
  chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
  body: string | null;
  read_url: string | null;
  media_url: string | null;
  published: boolean;
  status: SermonStatus;
  review_note: string | null;
  reviewed_at: string | null;
  author_name: string | null;
  is_mine: boolean;
};

export type Sermon = {
  id: string;
  church_id: string;
  created_by: string | null;
  title: string;
  speaker: string;
  sermon_date: string;
  /** The main passage as shown, like "John 3:16-18". Empty when none was chosen. */
  reference: string;
  book: string | null;
  chapter: number | null;
  verse_start: number | null;
  verse_end: number | null;
  /** Where to read the sermon, such as a SermonCentral page. The app stores no sermon text. */
  read_url: string | null;
  /** A video or audio link. */
  media_url: string | null;
  /** Drafts are visible to the Pastor only. */
  published: boolean;
  /** Who it comes from: the Pastor, a member's own article, or a link to an outside sermon. */
  source: SermonSource;
  /** A member's article text, or the short note on an external link. Null for the Pastor's link-only sermons. */
  body: string | null;
  /** Member and external entries wait for the Pastor's approval before every member can see them. */
  status: SermonStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionVisibility = 'pastor' | 'leaders' | 'church';

export type Question = {
  id: string;
  body: string;
  /** Null for an anonymous question. */
  asker_name: string | null;
  /** The viewer asked this (named) question, so they can take it down. */
  is_mine: boolean;
  /** Rounded to the day for anonymous questions. */
  asked_at: string;
  answer: string | null;
  answered_by_name: string | null;
  answered_at: string | null;
  /** Who can see it: only the Pastor (and the asker of a named question), the church leaders, or everyone. */
  visibility: QuestionVisibility;
};

export type AnonymousInboxItem = {
  id: string;
  body: string;
  /** A date only, never a time. */
  sent_on: string;
  /** The sender asked for a reply, so they hold a code. */
  can_reply: boolean;
  is_read: boolean;
  reply: string | null;
  replied_on: string | null;
};

export type AnonymousReplyCheck = {
  found: boolean;
  body: string | null;
  reply: string | null;
  replied_on: string | null;
};

export type MyElderThread = {
  thread_id: string;
  last_message_at: string | null;
  /** The elders have replied since the member last opened the thread. */
  unread: boolean;
};

export type ElderInboxItem = {
  thread_id: string;
  member_id: string;
  member_name: string;
  member_avatar_path: string | null;
  last_message_at: string;
  last_message_preview: string;
  last_sender_id: string | null;
  /** The member wrote last and no leader has answered yet. */
  needs_reply: boolean;
};

export type ElderMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  from_member: boolean;
};

export type RsvpStatus = 'going' | 'maybe' | 'no';

export type RsvpSummary = {
  going: number;
  maybe: number;
  declined: number;
  /** The caller's own answer, or null if they haven't answered. */
  my_status: RsvpStatus | null;
  /** Who answered what. Only the event's creator and church leaders get this; everyone else gets null. */
  people: { name: string; status: RsvpStatus }[] | null;
};

export type Announcement = {
  id: string;
  church_id: string;
  author_id: string;
  title: string;
  body: string;
  /** Null means it stays until a leader removes it. */
  expires_at: string | null;
  created_at: string;
};

export type PollOption = {
  id: string;
  label: string;
  /** Null while the totals are hidden: until you have voted, or the poll has closed. */
  votes: number | null;
};

export type PollSummary = {
  id: string;
  creator_id: string;
  creator_name: string;
  question: string;
  multiple: boolean;
  closes_at: string | null;
  is_closed: boolean;
  created_at: string;
  total_voters: number | null;
  my_option_ids: string[];
  options: PollOption[];
};

export type PrayerVisibility = 'church' | 'leaders' | 'pastor';

export type PrayerRequest = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_path: string | null;
  body: string;
  visibility: PrayerVisibility;
  answered: boolean;
  answered_at: string | null;
  created_at: string;
  prayer_count: number;
  i_prayed: boolean;
};

export type ChatPost = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar_path: string | null;
  body: string;
  created_at: string;
};

/** A chat group (a committee or fellowship). General, the church-wide chat, is not a group. */
export type ChatGroup = {
  id: string;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
};

/** A group as the Pastor and elders see it when managing: they may not be in it. */
export type ManageableChatGroup = ChatGroup & { i_am_member: boolean };

export type ChatGroupMember = { user_id: string; full_name: string; avatar_path: string | null };

/** Unread messages in one chat. group_id is null for General. */
export type ChatUnread = { group_id: string | null; unread: number };

export type SosStatus = 'active' | 'safe' | 'false_alarm' | 'ended_by_leader' | 'expired';

export type SosAlert = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar_path: string | null;
  message: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  location_at: string | null;
  started_at: string;
};

export type SosHistoryEntry = {
  id: string;
  sender_name: string;
  status: SosStatus;
  message: string;
  started_at: string;
  ended_at: string | null;
};

export type SosAlertRow = {
  id: string;
  church_id: string;
  sender_id: string;
  status: SosStatus;
  message: string;
  started_at: string;
  ended_at: string | null;
};

export type ConversationSummary = {
  id: string;
  other_user_id: string;
  other_name: string;
  other_avatar_path: string | null;
  last_message_at: string;
  last_message_preview: string;
  last_sender_id: string | null;
  unread: boolean;
};

export type Messageable = {
  user_id: string;
  full_name: string;
  avatar_path: string | null;
  role: MemberRole;
};

export type ChurchSearchResult = Pick<Church, 'id' | 'name' | 'city' | 'accent_color' | 'logo_path'>;

export type ChurchForReview = {
  id: string;
  name: string;
  city: string;
  contact_email: string;
  created_at: string;
  created_by_name: string | null;
  member_count: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        { id: string; full_name?: string; avatar_path?: string | null },
        { full_name?: string; avatar_path?: string | null; birth_month?: number | null; birth_day?: number | null }
      >;
      church_funds: Table<
        ChurchFunds,
        Pick<ChurchFunds, 'church_id'> & Partial<Pick<ChurchFunds, 'currency' | 'opening_balance' | 'opening_date' | 'account_label'>>,
        Partial<Pick<ChurchFunds, 'currency' | 'opening_balance' | 'opening_date' | 'account_label'>>,
        [Relationship<'church_funds_church_id_fkey', 'church_id', 'churches'>]
      >;
      fund_transactions: Table<
        FundTransaction,
        Pick<FundTransaction, 'church_id' | 'occurred_on' | 'description' | 'amount' | 'created_by'> &
          Partial<Pick<FundTransaction, 'note' | 'party_name' | 'party_user_id'>>,
        Partial<Pick<FundTransaction, 'occurred_on' | 'description' | 'note' | 'amount' | 'party_name' | 'party_user_id'>>,
        [
          Relationship<'fund_transactions_church_id_fkey', 'church_id', 'churches'>,
          Relationship<'fund_transactions_created_by_fkey', 'created_by', 'profiles'>,
          Relationship<'fund_transactions_updated_by_fkey', 'updated_by', 'profiles'>,
        ]
      >;
      fundraisers: Table<
        Fundraiser,
        Pick<Fundraiser, 'church_id' | 'title' | 'created_by'> &
          Partial<Pick<Fundraiser, 'description' | 'target_amount' | 'currency'>>,
        Partial<Pick<Fundraiser, 'title' | 'description' | 'target_amount' | 'currency' | 'status'>>,
        [
          Relationship<'fundraisers_church_id_fkey', 'church_id', 'churches'>,
          Relationship<'fundraisers_created_by_fkey', 'created_by', 'profiles'>,
        ]
      >;
      fundraiser_entries: Table<
        FundraiserEntry,
        Pick<FundraiserEntry, 'fundraiser_id' | 'church_id' | 'kind' | 'amount' | 'created_by'> &
          Partial<Pick<FundraiserEntry, 'party_name' | 'party_user_id' | 'occurred_on' | 'note'>>,
        Partial<Pick<FundraiserEntry, 'amount' | 'party_name' | 'party_user_id' | 'occurred_on' | 'note'>>,
        [Relationship<'fundraiser_entries_created_by_fkey', 'created_by', 'profiles'>]
      >;
      worship_plans: Table<WorshipPlan, never, never, [Relationship<'worship_plans_church_id_fkey', 'church_id', 'churches'>]>;
      worship_songs: Table<WorshipSong, never, never, [Relationship<'worship_songs_church_id_fkey', 'church_id', 'churches'>]>;
      church_songs: Table<
        ChurchSong,
        Pick<ChurchSong, 'church_id' | 'title' | 'created_by'> & Partial<Pick<ChurchSong, 'artist' | 'link' | 'language' | 'tags'>>,
        Partial<Pick<ChurchSong, 'title' | 'artist' | 'link' | 'language' | 'tags'>>,
        [Relationship<'church_songs_church_id_fkey', 'church_id', 'churches'>]
      >;
      bible_notes: Table<
        BibleNote,
        Pick<BibleNote, 'user_id' | 'book' | 'chapter' | 'verse' | 'body'>,
        Pick<BibleNote, 'body' | 'updated_at'>,
        []
      >;
      quiz_questions: Table<
        QuizQuestion,
        Pick<QuizQuestion, 'church_id' | 'created_by' | 'question' | 'options' | 'correct_index' | 'level'> &
          Partial<Pick<QuizQuestion, 'explanation' | 'reference' | 'week_of'>>,
        never,
        [Relationship<'quiz_questions_church_id_fkey', 'church_id', 'churches'>]
      >;
      special_days: Table<
        SpecialDay,
        Pick<SpecialDay, 'church_id' | 'kind' | 'name' | 'month' | 'day' | 'created_by'> & Partial<Pick<SpecialDay, 'year'>>,
        never,
        [Relationship<'special_days_church_id_fkey', 'church_id', 'churches'>]
      >;
      platform_admins: Table<{ user_id: string }, never, never>;
      churches: Table<
        Church,
        never,
        Partial<
          Pick<
            Church,
            'name' | 'city' | 'contact_email' | 'accent_color' | 'logo_path' | 'requires_approval' | 'directory_enabled'
          >
        >
      >;
      church_join_codes: Table<ChurchJoinCode, never, never>;
      memberships: Table<
        Membership,
        never,
        { directory_visible?: boolean },
        [
          Relationship<'memberships_church_id_fkey', 'church_id', 'churches'>,
          Relationship<'memberships_profile_fkey', 'user_id', 'profiles'>,
        ]
      >;
      daily_verses: Table<
        DailyVerse,
        Pick<DailyVerse, 'church_id' | 'verse_date' | 'reference' | 'verse_text' | 'created_by'> &
          Partial<Pick<DailyVerse, 'translation' | 'reflection'>>,
        Partial<Pick<DailyVerse, 'reference' | 'verse_text' | 'translation' | 'reflection' | 'updated_at'>>,
        [Relationship<'daily_verses_church_id_fkey', 'church_id', 'churches'>]
      >;
      events: Table<
        ChurchEvent,
        Pick<ChurchEvent, 'church_id' | 'title' | 'starts_at' | 'created_by'> &
          Partial<Pick<ChurchEvent, 'description' | 'location' | 'ends_at'>>,
        Partial<Pick<ChurchEvent, 'title' | 'description' | 'location' | 'starts_at' | 'ends_at' | 'updated_at'>>,
        [
          Relationship<'events_church_id_fkey', 'church_id', 'churches'>,
          Relationship<'events_created_by_fkey', 'created_by', 'profiles'>,
        ]
      >;
      messages: Table<
        Message,
        Pick<Message, 'conversation_id' | 'sender_id' | 'body'>,
        never,
        [Relationship<'messages_conversation_id_fkey', 'conversation_id', 'conversations'>]
      >;
      sermons: Table<
        Sermon,
        Pick<Sermon, 'church_id' | 'created_by' | 'title' | 'sermon_date'> &
          Partial<Pick<Sermon, 'speaker' | 'reference' | 'book' | 'chapter' | 'verse_start' | 'verse_end' | 'read_url' | 'media_url' | 'published' | 'body'>>,
        Partial<
          Pick<
            Sermon,
            'title' | 'speaker' | 'sermon_date' | 'reference' | 'book' | 'chapter' | 'verse_start' | 'verse_end' | 'read_url' | 'media_url' | 'published' | 'body' | 'updated_at'
          >
        >,
        [
          Relationship<'sermons_church_id_fkey', 'church_id', 'churches'>,
          Relationship<'sermons_created_by_fkey', 'created_by', 'profiles'>,
        ]
      >;
      announcements: Table<
        Announcement,
        Pick<Announcement, 'church_id' | 'author_id' | 'title'> & Partial<Pick<Announcement, 'body' | 'expires_at'>>,
        never,
        [Relationship<'announcements_church_id_fkey', 'church_id', 'churches'>]
      >;
      church_chat_messages: Table<
        { id: string; church_id: string; group_id: string | null; sender_id: string; body: string; created_at: string },
        { church_id: string; sender_id: string; body: string; group_id?: string | null },
        never,
        [Relationship<'church_chat_messages_church_id_fkey', 'church_id', 'churches'>]
      >;
      push_tokens: Table<
        PushToken,
        Pick<PushToken, 'token' | 'user_id' | 'platform'> & { updated_at?: string },
        Partial<PushToken>
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      register_church: {
        Args: { p_name: string; p_city: string; p_contact_email: string; p_accent_color?: string };
        Returns: string;
      };
      join_church_by_code: { Args: { p_code: string }; Returns: string };
      request_to_join: { Args: { p_church: string }; Returns: undefined };
      search_churches: { Args: { p_query: string }; Returns: ChurchSearchResult[] };
      approve_member: { Args: { p_church: string; p_user: string }; Returns: undefined };
      remove_member: { Args: { p_church: string; p_user: string }; Returns: undefined };
      set_member_role: { Args: { p_church: string; p_user: string; p_role: MemberRole }; Returns: undefined };
      regenerate_join_code: { Args: { p_church: string }; Returns: string };
      set_church_status: { Args: { p_church: string; p_status: ChurchStatus }; Returns: undefined };
      list_churches_for_review: { Args: { p_status?: ChurchStatus }; Returns: ChurchForReview[] };
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      start_conversation: { Args: { p_church: string; p_other: string }; Returns: string };
      mark_conversation_read: { Args: { p_conversation: string }; Returns: undefined };
      report_content: {
        Args: { p_church: string; p_type: ReportTargetType; p_target: string; p_reason: ReportReason; p_details?: string };
        Returns: undefined;
      };
      report_queue: { Args: { p_church: string }; Returns: ReportItem[] };
      platform_report_queue: { Args: Record<string, never>; Returns: ReportItem[] };
      resolve_report: { Args: { p_report: string; p_dismiss: boolean; p_note?: string | null }; Returns: undefined };
      submit_sermon: {
        Args: {
          p_church: string;
          p_source: 'member' | 'external';
          p_title: string;
          p_speaker: string;
          p_reference: string;
          p_book: string | null;
          p_chapter: number | null;
          p_verse_start: number | null;
          p_verse_end: number | null;
          p_body: string | null;
          p_url: string | null;
        };
        Returns: string;
      };
      edit_submission: {
        Args: {
          p_sermon: string;
          p_title: string;
          p_speaker: string;
          p_reference: string;
          p_book: string | null;
          p_chapter: number | null;
          p_verse_start: number | null;
          p_verse_end: number | null;
          p_body: string | null;
          p_url: string | null;
        };
        Returns: undefined;
      };
      review_sermon: { Args: { p_sermon: string; p_approve: boolean; p_note?: string | null }; Returns: undefined };
      sermon_feed: { Args: { p_church: string }; Returns: SermonItem[] };
      sermon_detail: { Args: { p_sermon: string }; Returns: SermonDetail[] };
      ask_question: { Args: { p_church: string; p_body: string; p_anonymous?: boolean }; Returns: undefined };
      qa_feed: { Args: { p_church: string }; Returns: Question[] };
      set_question_visibility: { Args: { p_question: string; p_visibility: QuestionVisibility }; Returns: undefined };
      answer_question: { Args: { p_question: string; p_answer: string }; Returns: undefined };
      delete_question: { Args: { p_question: string }; Returns: undefined };
      send_anonymous_message: { Args: { p_church: string; p_body: string; p_want_reply?: boolean }; Returns: string | null };
      check_anonymous_reply: { Args: { p_code: string }; Returns: AnonymousReplyCheck[] };
      anonymous_inbox: { Args: { p_church: string }; Returns: AnonymousInboxItem[] };
      mark_anonymous_read: { Args: { p_message: string }; Returns: undefined };
      reply_to_anonymous: { Args: { p_message: string; p_reply: string }; Returns: undefined };
      delete_anonymous_message: { Args: { p_message: string }; Returns: undefined };
      send_to_elders: { Args: { p_church: string; p_body: string }; Returns: { thread_id: string; message_id: string }[] };
      reply_as_elder: { Args: { p_thread: string; p_body: string }; Returns: string };
      my_elder_thread: { Args: { p_church: string }; Returns: MyElderThread[] };
      elder_inbox: { Args: { p_church: string }; Returns: ElderInboxItem[] };
      elder_thread_messages: { Args: { p_thread: string }; Returns: ElderMessage[] };
      mark_elder_thread_read: { Args: { p_thread: string }; Returns: undefined };
      set_rsvp: { Args: { p_event: string; p_status: RsvpStatus | null }; Returns: undefined };
      event_rsvp_summary: { Args: { p_event: string }; Returns: RsvpSummary[] };
      create_prayer_request: {
        Args: { p_church: string; p_body: string; p_visibility?: PrayerVisibility };
        Returns: string;
      };
      prayer_feed: { Args: { p_church: string }; Returns: PrayerRequest[] };
      toggle_prayed: { Args: { p_request: string }; Returns: boolean };
      set_prayer_answered: { Args: { p_request: string; p_answered: boolean }; Returns: undefined };
      delete_prayer_request: { Args: { p_request: string }; Returns: undefined };
      create_poll: {
        Args: { p_church: string; p_question: string; p_options: string[]; p_multiple?: boolean; p_closes_at?: string | null };
        Returns: string;
      };
      cast_vote: { Args: { p_poll: string; p_options: string[] }; Returns: undefined };
      close_poll: { Args: { p_poll: string }; Returns: undefined };
      delete_poll: { Args: { p_poll: string }; Returns: undefined };
      active_sos_alerts: { Args: { p_church: string }; Returns: SosAlert[] };
      sos_history: { Args: { p_church: string }; Returns: SosHistoryEntry[] };
      update_sos_location: {
        Args: { p_alert: string; p_latitude: number; p_longitude: number; p_accuracy?: number | null };
        Returns: undefined;
      };
      end_sos_alert: { Args: { p_alert: string; p_reason: 'safe' | 'false_alarm' | 'ended_by_leader' }; Returns: undefined };
      fundraiser_summaries: { Args: { p_church: string }; Returns: FundraiserSummary[] };
      set_my_pledge: { Args: { p_fundraiser: string; p_amount: number | null }; Returns: undefined };
      song_library: { Args: { p_church: string }; Returns: SongLibraryEntry[] };
      set_worship_leader: { Args: { p_church: string; p_user: string; p_value: boolean }; Returns: undefined };
      can_plan_worship: { Args: { p_church: string }; Returns: boolean };
      save_worship_plan: {
        Args: {
          p_church: string;
          p_date: string;
          p_chapter: number | null;
          p_verse_start: number | null;
          p_verse_end: number | null;
          p_note: string;
          p_songs: { title: string; artist: string; link: string; language?: SongLanguage; tags?: string[] }[];
        };
        Returns: string;
      };
      church_funds_summary: { Args: { p_church: string }; Returns: FundsSummary[] };
      church_special_days: { Args: { p_church: string }; Returns: SpecialDayEntry[] };
      church_polls: { Args: { p_church: string }; Returns: PollSummary[] };
      church_chat_unread_count: { Args: { p_church: string }; Returns: number };
      mark_church_chat_read: { Args: { p_church: string }; Returns: undefined };
      church_chat_feed: { Args: { p_church: string; p_limit?: number; p_group?: string | null }; Returns: ChatPost[] };
      chat_unread_counts: { Args: { p_church: string }; Returns: ChatUnread[] };
      mark_chat_group_read: { Args: { p_group: string }; Returns: undefined };
      my_chat_groups: { Args: { p_church: string }; Returns: ChatGroup[] };
      manageable_chat_groups: { Args: { p_church: string }; Returns: ManageableChatGroup[] };
      chat_group_members_list: { Args: { p_group: string }; Returns: ChatGroupMember[] };
      create_chat_group: {
        Args: { p_church: string; p_name: string; p_description: string; p_members: string[] };
        Returns: string;
      };
      update_chat_group: { Args: { p_group: string; p_name: string; p_description: string }; Returns: undefined };
      set_chat_group_members: { Args: { p_group: string; p_members: string[] }; Returns: undefined };
      delete_chat_group: { Args: { p_group: string }; Returns: undefined };
      my_conversations: { Args: { p_church: string }; Returns: ConversationSummary[] };
      messageable_members: { Args: { p_church: string }; Returns: Messageable[] };
    };
    Enums: {
      church_status: ChurchStatus;
      member_role: MemberRole;
      membership_status: MembershipStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
