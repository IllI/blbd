/** This feature is beta-only until a separate production rollout is approved. */
export function betaIsIsolated(env: Record<string, string | undefined> = process.env): boolean {
  const ref = env.BLBD_BETA_SUPABASE_PROJECT_REF?.trim();
  if (env.BLBD_ADMIN_ENVIRONMENT !== 'beta' || !ref || ref === 'ihghsacsxvibtwoiyjag') return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return url.protocol === 'https:' && url.hostname === `${ref}.supabase.co`;
  }
  catch { return false; }
}
