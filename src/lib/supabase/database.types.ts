/**
 * Hand-maintained Supabase schema types, kept in sync with
 * supabase/migrations/0001_init.sql.
 *
 * Insert/Update are written as flat object types (not intersections): the
 * Postgrest type inference collapses intersection-based table types to
 * `never`, which is why these are spelled out column by column. If the schema
 * changes, the fastest path is:
 *   supabase gen types typescript --local > src/lib/supabase/database.types.ts
 * then re-export under the same `Database` name.
 */
import type {
  BlogComment,
  Goal,
  MembershipEvent,
  NewsletterSubscriber,
  Profile,
} from '@/lib/types';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          website?: string | null;
          is_public?: boolean;
          show_goals_publicly?: boolean;
          is_admin?: boolean;
          membership_tier?: Profile['membership_tier'];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          location?: string | null;
          website?: string | null;
          is_public?: boolean;
          show_goals_publicly?: boolean;
          is_admin?: boolean;
          membership_tier?: Profile['membership_tier'];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: Goal;
        Insert: {
          id?: string;
          user_id: string;
          category: Goal['category'];
          position: number;
          title: string;
          description?: string | null;
          is_completed?: boolean;
          target_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category?: Goal['category'];
          position?: number;
          title?: string;
          description?: string | null;
          is_completed?: boolean;
          target_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      blog_comments: {
        Row: BlogComment;
        Insert: {
          id?: string;
          post_slug: string;
          user_id: string;
          parent_id?: string | null;
          content: string;
          is_edited?: boolean;
          is_flagged?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          is_edited?: boolean;
          is_flagged?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: NewsletterSubscriber;
        Insert: {
          id?: string;
          email: string;
          user_id?: string | null;
          is_confirmed?: boolean;
          confirmation_token?: string | null;
          unsubscribe_token?: string;
          subscribed_at?: string;
          confirmed_at?: string | null;
          unsubscribed_at?: string | null;
        };
        Update: {
          email?: string;
          user_id?: string | null;
          is_confirmed?: boolean;
          confirmation_token?: string | null;
          confirmed_at?: string | null;
          unsubscribed_at?: string | null;
        };
        Relationships: [];
      };
      membership_events: {
        Row: MembershipEvent;
        Insert: {
          id?: string;
          user_id: string;
          event_type: MembershipEvent['event_type'];
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          metadata?: Record<string, unknown>;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
