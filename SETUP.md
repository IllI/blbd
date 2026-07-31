# BLBD Portal — Setup & Deploy

Everything needed to take `blbd-portal/` from code to live at `app.blbd.life`.
Ordered so each step unblocks the next. You have the Supabase and Vercel CLIs
connected already — those steps use them.

Accounts you'll need: **Supabase** (have it), **Vercel** (have it), **Stripe**
(create if none), **Resend** (create). Everything is free tier.

---

> **Status (2026-07-30):** Step 1 is DONE. Org **BLBD**
> (`tbhajxnvtmmosisaibuc`) and project **blbd**
> (`ihghsacsxvibtwoiyjag`, East US) created; schema pushed and verified
> (tables, RLS, tier-gating triggers, avatars bucket, realtime all confirmed).
> Real Supabase keys are in `.env.local`; the DB password is in
> `.supabase-db-password.txt` (both gitignored). Remaining: Auth URL config
> (step 1.2, needed at deploy), Stripe, Resend, Vercel, DNS, webhook.

## 1 · Supabase project + schema

The migration lives at `supabase/migrations/0001_init.sql` and is idempotent
enough to run once cleanly.

### Option A — hosted project via CLI (recommended)

```bash
cd blbd-portal
# Create the project (pick your org; save the DB password it prints):
supabase projects create blbd --org-id <your-org-id> --region us-east-1 --db-password '<strong-password>'
# Link this folder to it:
supabase link --project-ref <project-ref>
# Push the schema:
supabase db push
```

If `db push` reports it wants a migration under `supabase/migrations/`, it's
already there (`0001_init.sql`) — it will apply it.

### Option B — paste in the dashboard

Open the project → SQL Editor → paste all of `supabase/migrations/0001_init.sql`
→ Run.

### Then, in the dashboard

1. **Authentication → Providers → Email**: enabled. Turn **Confirm email** on.
2. **Authentication → URL Configuration**:
   - Site URL: `https://app.blbd.life`
   - Redirect URLs: add `https://app.blbd.life/auth/callback` and
     `http://localhost:3000/auth/callback` (for local dev).
3. **(Optional) Google OAuth**: Providers → Google, add client ID/secret, then
   set `NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH=true` in env. Add
   `https://<project>.supabase.co/auth/v1/callback` as an authorized redirect
   in Google Cloud Console.
4. **Project Settings → API**: copy the **Project URL**, **anon key**, and
   **service_role key** for step 4.

> Verify: **Authentication → Users → Add user** (with a password). A row should
> appear in **Table Editor → profiles** automatically. If not, the
> `on_auth_user_created` trigger didn't apply — re-run the migration.

---

## 1c · Social login (Google + Facebook)

The buttons are built and will appear automatically once each provider is
enabled **and** its flag is set. Both steps are required — a button for an
unconfigured provider fails with an opaque "provider is not enabled" error,
which is why they're flag-gated.

> The flags are `NEXT_PUBLIC_*`, so they are **inlined at build time**.
> Changing them requires a **redeploy**, not just an env update.

### Google
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
   **Create Credentials → OAuth client ID → Web application**.
2. Authorized redirect URI:
   `https://ihghsacsxvibtwoiyjag.supabase.co/auth/v1/callback`
3. Copy the Client ID + Secret.
4. Supabase → **Authentication → Providers → Google** → enable, paste both, save.
5. Then:
   ```bash
   printf '%s' 'true' | vercel env add NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH production --force
   vercel --prod
   ```

### Facebook
1. [Meta for Developers](https://developers.facebook.com/apps) → **Create App**
   → type **Consumer** → add the **Facebook Login** product.
2. Facebook Login → Settings → Valid OAuth Redirect URIs:
   `https://ihghsacsxvibtwoiyjag.supabase.co/auth/v1/callback`
3. Settings → Basic: copy **App ID** + **App Secret**.
4. Supabase → **Authentication → Providers → Facebook** → enable, paste both, save.
5. Then:
   ```bash
   printf '%s' 'true' | vercel env add NEXT_PUBLIC_ENABLE_FACEBOOK_OAUTH production --force
   vercel --prod
   ```

> Facebook requires the app to be switched from *Development* to *Live* mode
> before anyone outside your test users can sign in, and it requires a valid
> Privacy Policy URL — `https://blbd.life/privacy-policy` already exists.

---

## 2 · Stripe products

1. Create a Stripe account (test mode is fine to start).
2. **Products** → create three, each with a **recurring monthly** price:
   - Supporter — $5/mo
   - Member — $15/mo
   - Founding — $50/mo
3. Copy each **price ID** (`price_…`) for step 4.
4. **Developers → API keys**: copy the secret (`sk_test_…`) and publishable
   (`pk_test_…`) keys.
5. The webhook secret comes in step 6 (needs the deployed URL).

---

## 3 · Resend

1. Create a Resend account.
2. **Domains → Add domain** → `blbd.life`. Resend shows DNS records (SPF/DKIM,
   a `resend._domainkey` CNAME, and an MX for the bounce subdomain). Add them
   in GoDaddy **alongside** the existing Google MX records — don't replace
   anything. Wait for "Verified".
3. **API Keys → Create** → copy `re_…`.

> Until the domain verifies, set `RESEND_FROM_EMAIL="BLBD <onboarding@resend.dev>"`
> to test sends; switch to `contact@blbd.life` once verified.

---

## 4 · Environment variables

Copy `.env.local.example` → `.env.local` and fill in everything from steps 1–3.
The repo already has a placeholder `.env.local` (so builds work) — overwrite it.

`.env.local` is gitignored. For Vercel, the same keys go in
**Project → Settings → Environment Variables** (step 5).

---

## 5 · Deploy to Vercel + DNS

```bash
cd blbd-portal
vercel link          # link to a new or existing project
vercel env pull      # optional: sanity-check what's set
# Add each var (repeat for production; --sensitive for secrets):
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# …repeat for every key in .env.local.example…
vercel --prod        # first production deploy
```

**DNS (GoDaddy)** — add the subdomain CNAME. Do this early; propagation can
take a while:

```
Type   Name   Value                  TTL
CNAME  app    cname.vercel-dns.com    600
```

Then in Vercel: **Project → Settings → Domains → Add** `app.blbd.life`. Vercel
issues the SSL cert once DNS resolves. Leave the root `blbd.life` records
pointing at Webflow — untouched.

---

## 6 · Stripe webhook

Once `app.blbd.life` is live:

1. Stripe **Developers → Webhooks → Add endpoint**:
   - URL: `https://app.blbd.life/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_succeeded`, `invoice.payment_failed`.
2. Copy the **Signing secret** (`whsec_…`) → set `STRIPE_WEBHOOK_SECRET` in
   Vercel → redeploy.

**Local testing:**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# use the whsec_ it prints as STRIPE_WEBHOOK_SECRET in .env.local
```

---

## 7 · Webflow integration

All snippets are in `webflow/`:

- `comment-embed.html` → Blog Post **CMS template**, one Embed element at the
  bottom of the post body.
- `newsletter-intercept.html` → **Project Settings → Custom Code → Footer Code**.
- `navbar-links.md` → manual Designer link changes (login/join/CTA buttons).

Publish the Webflow site after adding these.

---

## 7b · Seed blog drafts into Webflow CMS (optional)

Three drafts are extracted from the content doc in `scripts/blog-posts.json`.
The importer creates them as **drafts** (never auto-publishes).

```bash
# Webflow → Site Settings → Apps & Integrations → API access → new token
# (Content: read + write). Then:
export WEBFLOW_API_TOKEN=...   # PowerShell: $env:WEBFLOW_API_TOKEN='...'

node scripts/seed-webflow-blog.mjs --discover   # confirm site + field mapping
node scripts/seed-webflow-blog.mjs --dry-run    # preview, creates nothing
node scripts/seed-webflow-blog.mjs --seed       # create drafts
```

Review and publish the drafts in the Webflow Designer. If `--discover` shows the
body/summary fields weren't detected, tell me the field slugs and I'll adjust
the mapping in `scripts/seed-webflow-blog.mjs`.

---

## 8 · Make Dan an admin

After Dan signs up through the portal, flip the flag (service-role only):

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'contact@blbd.life');
```

The **Newsletter** nav item then appears for that account.

---

## Local development

```bash
cd blbd-portal
npm install
npm run dev      # http://localhost:3000
```

With a real `.env.local` pointing at the hosted Supabase project, everything
works locally except Stripe webhooks (use `stripe listen`, step 6).

## Verification checklist

- [ ] Sign up → confirmation email → land on dashboard
- [ ] Edit profile, upload avatar, view public profile at `/profile/<id>`
- [ ] Add living + dying goals, reorder, mark complete (free = 2/list)
- [ ] Upgrade with test card `4242 4242 4242 4242` → tier updates after webhook
- [ ] With a paid tier: comment on `/embed/comments?slug=test`, reply, edit, delete
- [ ] Newsletter subscribe → confirm email → admin sends a test
- [ ] Webflow navbar login/join land on the portal
