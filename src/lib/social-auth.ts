import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireEnv } from '@/lib/env';
import { betaIsIsolated } from '@/lib/admin/environment';

export const SOCIAL_PROVIDERS = { google: 'google', yahoo: 'custom:yahoo' } as const;
export type SocialProvider = keyof typeof SOCIAL_PROVIDERS;
export type SocialReadiness = { google: boolean; yahoo: boolean };

/** Read actual beta Auth configuration, not a browser flag or email domain.
 * No provider credentials, claims, profile data or service key leave the server. */
export async function socialReadiness(): Promise<SocialReadiness> {
  if (!betaIsIsolated()) throw new Error('Beta social authentication requires the isolated beta database.');
  const [settings, custom] = await Promise.all([
    fetch(`${requireEnv('NEXT_PUBLIC_SUPABASE_URL')}/auth/v1/settings`, {
      headers: { apikey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') },
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    }),
    createAdminClient().auth.admin.customProviders.listProviders(),
  ]);
  if (!settings.ok || custom.error) throw new Error('Could not verify beta sign-in provider configuration.');
  const body = await settings.json();
  return {
    google: body.external?.google === true,
    yahoo: custom.data.providers.some(p => p.identifier === SOCIAL_PROVIDERS.yahoo && p.enabled === true && !!p.client_id),
  };
}
