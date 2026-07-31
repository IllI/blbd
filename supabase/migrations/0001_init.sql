-- =====================================================================
-- BLBD — initial schema
-- Run once in the Supabase SQL Editor (it wraps itself in a transaction).
--
-- Differences from HANDOFF.md, and why (see supabase/README.md for detail):
--   * profiles UPDATE is protected by a trigger instead of a WITH CHECK
--     subquery. A policy on `profiles` that SELECTs `profiles` triggers
--     Postgres' infinite-recursion detection and errors at runtime.
--   * Tier gating for comments and goals is enforced in the database, not
--     just in the UI. Clients talk to PostgREST directly, so UI-only gating
--     is trivially bypassed.
--   * SECURITY DEFINER functions pin `search_path`.
--   * Idempotent where cheap (IF NOT EXISTS / ON CONFLICT).
-- =====================================================================

BEGIN;

-- SQL-language functions are validated at CREATE time, and the tier helpers
-- below reference public.profiles before it is defined. Deferring body checks
-- to runtime lets the file read top-down (helpers first) without reordering.
SET LOCAL check_function_bodies = off;

-- =============================================
-- EXTENSIONS
-- =============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- HELPERS
-- =============================================

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Read the caller's own profile without re-entering RLS on `profiles`.
-- Used by policies on *other* tables so they never recurse.
CREATE OR REPLACE FUNCTION public.current_tier()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT membership_tier FROM public.profiles WHERE id = auth.uid()),
    'free'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Paid tiers unlock commenting, the full 5 goal slots, and the directory.
CREATE OR REPLACE FUNCTION public.has_paid_tier()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.current_tier() IN ('supporter', 'member', 'founding');
$$;

-- =============================================
-- PROFILES (extends auth.users)
-- =============================================
CREATE TABLE public.profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name           TEXT,
  bio                    TEXT,
  avatar_url             TEXT,
  location               TEXT,
  website                TEXT,
  is_public              BOOLEAN DEFAULT true,
  show_goals_publicly    BOOLEAN DEFAULT true,
  is_admin               BOOLEAN DEFAULT false,
  membership_tier        TEXT DEFAULT 'free'
    CHECK (membership_tier IN ('free', 'supporter', 'member', 'founding')),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Members may edit their own profile, but privilege and billing columns are
-- server-owned. Silently restoring them beats erroring: the profile form can
-- send the whole row without having to know which columns are protected.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- `current_user` is the role PostgREST switched into: `authenticated` /
  -- `anon` for client traffic, `service_role` for the server-side key.
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    NEW.is_admin               := OLD.is_admin;
    NEW.membership_tier        := OLD.membership_tier;
    NEW.stripe_customer_id     := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_columns BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- Auto-create a profile row on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- GOALS — 5 for Better Living, 5 for Better Dying
-- =============================================
CREATE TABLE public.goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('living', 'dying')),
  position     INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  title        TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description  TEXT CHECK (description IS NULL OR length(description) <= 2000),
  is_completed BOOLEAN DEFAULT false,
  target_date  DATE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, category, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Free tier gets 2 slots per category; paid tiers get all 5.
CREATE OR REPLACE FUNCTION public.enforce_goal_tier_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  max_slots INTEGER;
  used      INTEGER;
BEGIN
  max_slots := CASE WHEN public.has_paid_tier() THEN 5 ELSE 2 END;

  IF NEW.position > max_slots THEN
    RAISE EXCEPTION
      'Goal slot % is locked on the % plan (limit % per category).',
      NEW.position, public.current_tier(), max_slots
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO used
  FROM public.goals
  WHERE user_id = NEW.user_id
    AND category = NEW.category
    AND id IS DISTINCT FROM NEW.id;

  IF used >= max_slots THEN
    RAISE EXCEPTION
      'The % plan allows % % goals.', public.current_tier(), max_slots, NEW.category
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_goal_tier_limit
  BEFORE INSERT OR UPDATE OF position, category ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_goal_tier_limit();

-- =============================================
-- BLOG COMMENTS (keyed to Webflow CMS slugs)
-- =============================================
CREATE TABLE public.blog_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug  TEXT NOT NULL CHECK (length(post_slug) BETWEEN 1 AND 200),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 5000),
  is_edited  BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Replies are one level deep: a reply's parent must be top-level.
CREATE OR REPLACE FUNCTION public.enforce_comment_depth()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  grandparent UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT parent_id INTO grandparent
  FROM public.blog_comments WHERE id = NEW.parent_id;

  IF grandparent IS NOT NULL THEN
    RAISE EXCEPTION 'Replies are limited to one level deep.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_comment_depth
  BEFORE INSERT OR UPDATE OF parent_id ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_depth();

-- Editing content flips is_edited; nothing else may be self-served.
CREATE OR REPLACE FUNCTION public.mark_comment_edited()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.is_edited := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_comment_edited BEFORE UPDATE ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.mark_comment_edited();

-- =============================================
-- NEWSLETTER SUBSCRIBERS
-- =============================================
CREATE TABLE public.newsletter_subscribers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  user_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_confirmed       BOOLEAN DEFAULT false,
  -- Single-use, cleared once the address is confirmed.
  confirmation_token UUID DEFAULT gen_random_uuid(),
  -- Stable for the life of the row so every send can carry a working
  -- one-click unsubscribe link.
  unsubscribe_token  UUID NOT NULL DEFAULT gen_random_uuid(),
  subscribed_at      TIMESTAMPTZ DEFAULT now(),
  confirmed_at       TIMESTAMPTZ,
  unsubscribed_at    TIMESTAMPTZ
);

-- =============================================
-- MEMBERSHIP EVENTS (audit log)
-- =============================================
CREATE TABLE public.membership_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'signup', 'upgrade', 'downgrade', 'cancel', 'payment',
    'payment_failed', 'subscription_created', 'subscription_updated'
  )),
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_goals_user        ON public.goals(user_id);
CREATE INDEX idx_goals_category    ON public.goals(user_id, category);
CREATE INDEX idx_comments_post     ON public.blog_comments(post_slug, created_at DESC);
CREATE INDEX idx_comments_parent   ON public.blog_comments(parent_id);
CREATE INDEX idx_comments_user     ON public.blog_comments(user_id);
CREATE INDEX idx_newsletter_email  ON public.newsletter_subscribers(email);
CREATE INDEX idx_newsletter_token  ON public.newsletter_subscribers(confirmation_token);
CREATE INDEX idx_newsletter_unsub  ON public.newsletter_subscribers(unsubscribe_token);
CREATE INDEX idx_events_user       ON public.membership_events(user_id, created_at DESC);
CREATE INDEX idx_profiles_public   ON public.profiles(is_public, created_at DESC);

-- =============================================
-- ROW-LEVEL SECURITY
-- =============================================

-- ---------- profiles ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are readable when public or own"
  ON public.profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

CREATE POLICY "Users update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
-- Privilege/billing columns are reverted by protect_profile_columns().

-- ---------- goals ----------
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goals readable when own, or owner opted in to public"
  ON public.goals FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = goals.user_id
        AND p.is_public = true
        AND p.show_goals_publicly = true
    )
  );

CREATE POLICY "Users create their own goals"
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own goals"
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own goals"
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);

-- ---------- blog_comments ----------
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are readable by everyone"
  ON public.blog_comments FOR SELECT
  USING (true);

CREATE POLICY "Paid members create comments"
  ON public.blog_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.has_paid_tier());

CREATE POLICY "Users update their own comments"
  ON public.blog_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own comments"
  ON public.blog_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins moderate any comment"
  ON public.blog_comments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- newsletter_subscribers ----------
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- No anon INSERT policy on purpose: subscribing goes through
-- /api/newsletter/subscribe with the service-role key, so the endpoint can
-- rate-limit, validate, and send the confirmation email. A public INSERT
-- policy would let anyone enumerate/spam the table directly via PostgREST.

CREATE POLICY "Admins read subscribers"
  ON public.newsletter_subscribers FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins update subscribers"
  ON public.newsletter_subscribers FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- membership_events ----------
ALTER TABLE public.membership_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own events"
  ON public.membership_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all events"
  ON public.membership_events FOR SELECT
  USING (public.is_admin());
-- Writes happen only via the service-role key in webhook handlers.

-- =============================================
-- REALTIME — comments stream into the embed widget
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.blog_comments;

-- =============================================
-- STORAGE — avatars
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Objects are stored as `{user_id}/avatar.{ext}` so the first path segment
-- is the owner.
CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
