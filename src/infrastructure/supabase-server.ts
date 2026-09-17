import { cookies } from 'next/headers';
import { createServerClient as createSSRClient } from '@supabase/ssr';

/**
 * Klien server-side pakai anon key + sesi user, jadi RLS tetap berlaku.
 * Service role key TIDAK pernah dipakai di jalur request biasa dan tidak
 * pernah diimpor dari komponen klien (Section 45 / 64.12).
 */
export async function createServerClient() {
  const store = await cookies();
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => {
          try {
            store.set(name, value, options);
          } catch {
            // Handle set in Server Component gracefully
          }
        }),
      },
    },
  );
}

/**
 * Klien server-side dengan service role key untuk tugas administratif dan provisioning akun baru
 * yang membutuhkan bypass RLS (Section 64.12).
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServiceRoleClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service role operations');
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

