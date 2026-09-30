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

export type ChatPost = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar_path: string | null;
  body: string;
  created_at: string;
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
        { full_name?: string; avatar_path?: string | null }
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
      announcements: Table<
        Announcement,
        Pick<Announcement, 'church_id' | 'author_id' | 'title'> & Partial<Pick<Announcement, 'body' | 'expires_at'>>,
        never,
        [Relationship<'announcements_church_id_fkey', 'church_id', 'churches'>]
      >;
      church_chat_messages: Table<
        { id: string; church_id: string; sender_id: string; body: string; created_at: string },
        { church_id: string; sender_id: string; body: string },
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
      create_poll: {
        Args: { p_church: string; p_question: string; p_options: string[]; p_multiple?: boolean; p_closes_at?: string | null };
        Returns: string;
      };
      cast_vote: { Args: { p_poll: string; p_options: string[] }; Returns: undefined };
      close_poll: { Args: { p_poll: string }; Returns: undefined };
      delete_poll: { Args: { p_poll: string }; Returns: undefined };
      church_polls: { Args: { p_church: string }; Returns: PollSummary[] };
      church_chat_unread_count: { Args: { p_church: string }; Returns: number };
      mark_church_chat_read: { Args: { p_church: string }; Returns: undefined };
      church_chat_feed: { Args: { p_church: string; p_limit?: number }; Returns: ChatPost[] };
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
