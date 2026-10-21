-- Admin identity bootstrap, audited permissions, and resumable update mail.
BEGIN;

CREATE TABLE public.admin_bootstrap (
  email text PRIMARY KEY CHECK (email = lower(btrim(email))),
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz
);
INSERT INTO public.admin_bootstrap(email) VALUES
  ('contact@blbd.life'), ('admin@blbd.life'), ('dan@blbd.life'),
  ('kevin@blbd.life'), ('m.blake@blbd.life'), ('meghan@blbd.life');

CREATE TABLE public.admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- These are one-time invitations, not an email allowlist checked on every
-- request. Revoking an admin must NOT be undone by their next sign-in.
CREATE FUNCTION public.claim_initial_admin(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users
    WHERE id = p_user AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RETURN; END IF;
  PERFORM 1 FROM public.admin_bootstrap
    WHERE email = v_email AND claimed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.profiles SET is_admin = true WHERE id = p_user;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.admin_bootstrap SET claimed_by = p_user, claimed_at = now()
    WHERE email = v_email;
  INSERT INTO public.admin_audit(actor_id, action, target_id)
    VALUES (p_user, 'bootstrap_admin', p_user);
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name) VALUES
    (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1))) ON CONFLICT (id) DO NOTHING;
  PERFORM public.claim_initial_admin(NEW.id);
  RETURN NEW;
END; $$;
CREATE FUNCTION public.on_admin_email_verified() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.claim_initial_admin(NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_admin_email_verified AFTER UPDATE OF email, email_confirmed_at
  ON auth.users FOR EACH ROW EXECUTE FUNCTION public.on_admin_email_verified();
DO $$ DECLARE u record; BEGIN
  FOR u IN SELECT id FROM auth.users WHERE email_confirmed_at IS NOT NULL LOOP
    PERFORM public.claim_initial_admin(u.id);
  END LOOP;
END; $$;

CREATE FUNCTION public.assert_blbd_admin(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.id = p_actor AND p.is_admin AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
END; $$;

CREATE FUNCTION public.admin_set_account(p_actor uuid, p_user uuid, p_name text, p_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE old_profile public.profiles;
BEGIN
  -- Serialize permission changes, including concurrent last-admin removals.
  PERFORM pg_advisory_xact_lock(728193);
  PERFORM public.assert_blbd_admin(p_actor);
  SELECT * INTO STRICT old_profile FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF length(btrim(p_name)) > 100 OR p_admin IS NULL THEN
    RAISE EXCEPTION 'Invalid account details';
  END IF;
  IF p_admin AND NOT EXISTS (SELECT 1 FROM auth.users
    WHERE id = p_user AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Verify the user email before granting admin access';
  END IF;
  IF old_profile.is_admin AND NOT p_admin AND NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.is_admin AND p.id <> p_user AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot remove the last verified admin';
  END IF;
  UPDATE public.profiles SET display_name = nullif(btrim(p_name), ''), is_admin = p_admin WHERE id = p_user;
  INSERT INTO public.admin_audit(actor_id, action, target_id, details)
    VALUES (p_actor, 'update_account', p_user, jsonb_build_object(
      'old_name', old_profile.display_name, 'name', p_name,
      'old_admin', old_profile.is_admin, 'admin', p_admin));
END; $$;

CREATE TABLE public.mail_preferences (
  email text PRIMARY KEY CHECK (email = lower(btrim(email))),
  unsubscribe_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  opted_out_at timestamptz
);
CREATE TABLE public.mail_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  emails text[] NOT NULL CHECK (cardinality(emails) BETWEEN 1 AND 1000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Mirror legacy newsletter opt-outs so a change made during a running batch
-- is seen by the final per-recipient preference check too.
CREATE FUNCTION public.mirror_newsletter_opt_out() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.unsubscribed_at IS NOT NULL THEN
    INSERT INTO public.mail_preferences(email, opted_out_at)
      VALUES (lower(btrim(NEW.email)), NEW.unsubscribed_at)
      ON CONFLICT (email) DO UPDATE SET opted_out_at = EXCLUDED.opted_out_at;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER mirror_newsletter_opt_out AFTER INSERT OR UPDATE OF unsubscribed_at
  ON public.newsletter_subscribers FOR EACH ROW EXECUTE FUNCTION public.mirror_newsletter_opt_out();
INSERT INTO public.mail_preferences(email, opted_out_at)
  SELECT lower(btrim(email)), unsubscribed_at FROM public.newsletter_subscribers
  WHERE unsubscribed_at IS NOT NULL ON CONFLICT DO NOTHING;
CREATE TABLE public.mail_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 50000),
  audience jsonb NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'complete')),
  lease_id uuid,
  lease_until timestamptz,
  started_at timestamptz,
  tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mail_recipients (
  campaign_id uuid NOT NULL REFERENCES public.mail_campaigns(id) ON DELETE CASCADE,
  email text NOT NULL REFERENCES public.mail_preferences(email),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'skipped')),
  provider_id text,
  accepted_at timestamptz,
  PRIMARY KEY (campaign_id, email)
);

-- Only verified member accounts and confirmed subscribers are eligible.
-- A newsletter unsubscribe or update opt-out suppresses EVERY audience,
-- including manual individual selections and saved groups.
CREATE FUNCTION public.admin_mail_contacts()
RETURNS TABLE(email text, name text, member boolean, subscriber boolean, opted_out boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH sources AS (
    SELECT lower(u.email) email, p.display_name name, true member, false subscriber
    FROM auth.users u JOIN public.profiles p ON p.id = u.id
    WHERE u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
    UNION ALL
    SELECT lower(n.email), NULL, false, true FROM public.newsletter_subscribers n
    WHERE n.is_confirmed AND n.unsubscribed_at IS NULL
  )
  SELECT s.email, max(s.name), bool_or(s.member), bool_or(s.subscriber),
    (mp.opted_out_at IS NOT NULL OR EXISTS (SELECT 1 FROM public.newsletter_subscribers n
      WHERE lower(n.email) = s.email AND n.unsubscribed_at IS NOT NULL))
  FROM sources s LEFT JOIN public.mail_preferences mp ON mp.email = s.email
  GROUP BY s.email, mp.opted_out_at;
$$;

CREATE FUNCTION public.admin_mail_audience(p_audience jsonb)
RETURNS TABLE(email text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE kind text := p_audience->>'kind'; selected text[];
BEGIN
  IF kind NOT IN ('all', 'members', 'subscribers', 'individuals', 'group') OR kind IS NULL THEN
    RAISE EXCEPTION 'Invalid audience';
  END IF;
  IF kind = 'individuals' THEN
    SELECT array_agg(lower(btrim(v))) INTO selected
      FROM jsonb_array_elements_text(p_audience->'emails') v;
    IF coalesce(cardinality(selected), 0) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Select recipients'; END IF;
  ELSIF kind = 'group' THEN
    SELECT emails INTO selected FROM public.mail_groups WHERE id = (p_audience->>'groupId')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  END IF;
  RETURN QUERY SELECT c.email FROM public.admin_mail_contacts() c
    WHERE NOT c.opted_out AND (kind = 'all' OR (kind = 'members' AND c.member)
      OR (kind = 'subscribers' AND c.subscriber) OR c.email = ANY(selected));
END; $$;

CREATE FUNCTION public.admin_prepare_mail(p_actor uuid, p_subject text, p_body text, p_audience jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE campaign uuid; addresses text[];
BEGIN
  PERFORM public.assert_blbd_admin(p_actor);
  SELECT array_agg(a.email ORDER BY a.email) INTO addresses FROM public.admin_mail_audience(p_audience) a;
  IF coalesce(cardinality(addresses), 0) NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Audience must contain 1 to 10000 eligible contacts';
  END IF;
  INSERT INTO public.mail_campaigns(created_by, subject, body, audience, recipient_count)
    VALUES (p_actor, btrim(p_subject), btrim(p_body), p_audience, cardinality(addresses)) RETURNING id INTO campaign;
  INSERT INTO public.mail_preferences(email) SELECT unnest(addresses) ON CONFLICT DO NOTHING;
  INSERT INTO public.mail_recipients(campaign_id, email) SELECT campaign, unnest(addresses);
  INSERT INTO public.admin_audit(actor_id, action, target_id, details)
    VALUES (p_actor, 'prepare_mail', campaign, jsonb_build_object('count', cardinality(addresses), 'audience', p_audience));
  RETURN campaign;
END; $$;

CREATE FUNCTION public.admin_claim_mail(p_actor uuid, p_campaign uuid, p_lease uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.assert_blbd_admin(p_actor);
  UPDATE public.mail_campaigns SET lease_id = p_lease, lease_until = now() + interval '90 seconds',
    started_at = coalesce(started_at, now()), status = 'sending'
    WHERE id = p_campaign AND status <> 'complete' AND tested_at IS NOT NULL
      AND (lease_until IS NULL OR lease_until < now())
      -- Provider idempotency expires after 24h. Never automatically retry an
      -- old, possibly accepted send after that deduplication window closes.
      AND (started_at IS NULL OR started_at > now() - interval '23 hours');
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.admin_audit(actor_id, action, target_id) VALUES (p_actor, 'send_mail_batch', p_campaign);
  RETURN true;
END; $$;

CREATE FUNCTION public.unsubscribe_blbd_updates(p_token uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.mail_preferences SET opted_out_at = now() WHERE unsubscribe_token = p_token;
  UPDATE public.newsletter_subscribers SET unsubscribed_at = now()
    WHERE lower(email) IN (SELECT email FROM public.mail_preferences WHERE unsubscribe_token = p_token);
END; $$;

-- No public/client writes, even for admins: privileged operations go through
-- authenticated server routes. Read policies remain useful for admin pages.
ALTER TABLE public.admin_bootstrap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.admin_audit FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins read groups" ON public.mail_groups FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins read campaigns" ON public.mail_campaigns FOR SELECT TO authenticated USING (public.is_admin());
CREATE INDEX mail_recipients_pending ON public.mail_recipients(campaign_id, status, email);
CREATE INDEX mail_campaigns_created ON public.mail_campaigns(created_at DESC);
CREATE INDEX admin_audit_created ON public.admin_audit(created_at DESC);

REVOKE ALL ON public.admin_bootstrap, public.admin_audit, public.mail_preferences,
  public.mail_groups, public.mail_campaigns, public.mail_recipients FROM anon, authenticated;
GRANT SELECT ON public.admin_audit, public.mail_groups, public.mail_campaigns TO authenticated;
GRANT ALL ON public.admin_bootstrap, public.admin_audit, public.mail_preferences,
  public.mail_groups, public.mail_campaigns, public.mail_recipients TO service_role;
REVOKE ALL ON FUNCTION public.claim_initial_admin(uuid), public.handle_new_user(),
  public.on_admin_email_verified(), public.mirror_newsletter_opt_out(), public.assert_blbd_admin(uuid),
  public.admin_set_account(uuid, uuid, text, boolean), public.admin_mail_contacts(),
  public.admin_mail_audience(jsonb), public.admin_prepare_mail(uuid, text, text, jsonb),
  public.admin_claim_mail(uuid, uuid, uuid), public.unsubscribe_blbd_updates(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account(uuid, uuid, text, boolean),
  public.admin_mail_contacts(), public.admin_mail_audience(jsonb),
  public.admin_prepare_mail(uuid, text, text, jsonb), public.admin_claim_mail(uuid, uuid, uuid),
  public.unsubscribe_blbd_updates(uuid) TO service_role;
COMMIT;
