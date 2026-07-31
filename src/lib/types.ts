export type MembershipTier = 'free' | 'supporter' | 'member' | 'founding';
export type GoalCategory = 'living' | 'dying';

export type MembershipEventType =
  | 'signup'
  | 'upgrade'
  | 'downgrade'
  | 'cancel'
  | 'payment'
  | 'payment_failed'
  | 'subscription_created'
  | 'subscription_updated';

// NOTE: these are `type` aliases, not interfaces, on purpose. The Supabase
// Database types feed these into Postgrest's `Record<string, unknown>`
// constraint, and an `interface` (being open to declaration merging) does not
// satisfy that index signature — the schema silently degrades to `never`.

export type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  website: string | null;
  is_public: boolean;
  show_goals_publicly: boolean;
  is_admin: boolean;
  membership_tier: MembershipTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

/** The subset of a profile a member is allowed to edit themselves. */
export type EditableProfile = Pick<
  Profile,
  'display_name' | 'bio' | 'avatar_url' | 'location' | 'website' | 'is_public' | 'show_goals_publicly'
>;

export type Goal = {
  id: string;
  user_id: string;
  category: GoalCategory;
  position: number;
  title: string;
  description: string | null;
  is_completed: boolean;
  target_date: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogComment = {
  id: string;
  post_slug: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  is_edited: boolean;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
};

/** A comment joined with the author fields the widget renders. */
export type CommentWithAuthor = BlogComment & {
  author: Pick<Profile, 'display_name' | 'avatar_url' | 'membership_tier'> | null;
};

export type NewsletterSubscriber = {
  id: string;
  email: string;
  user_id: string | null;
  is_confirmed: boolean;
  confirmation_token: string | null;
  unsubscribe_token: string;
  subscribed_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

export type MembershipEvent = {
  id: string;
  user_id: string;
  event_type: MembershipEventType;
  metadata: Record<string, unknown>;
  created_at: string;
};
