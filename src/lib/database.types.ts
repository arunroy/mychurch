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
    };
    Enums: {
      church_status: ChurchStatus;
      member_role: MemberRole;
      membership_status: MembershipStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
