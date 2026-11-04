-- Additional one-time beta admin invitation requested by the owner.
BEGIN;
INSERT INTO public.admin_bootstrap(email) VALUES ('jonasgoldstein@gmail.com')
  ON CONFLICT (email) DO NOTHING;
-- Existing verified accounts can claim immediately. Unverified accounts still
-- must confirm their own mailbox; an already-claimed/revoked grant stays revoked.
SELECT public.claim_initial_admin(id) FROM auth.users
  WHERE lower(email) = 'jonasgoldstein@gmail.com' AND email_confirmed_at IS NOT NULL;
COMMIT;
