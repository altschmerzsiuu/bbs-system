import { redirect } from 'next/navigation';
import { createServerClient } from '@/infrastructure/supabase-server';
import type { ActorContext } from '@/modules/bookings/booking-service';

import { cache } from 'react';

/**
 * Satu-satunya sumber identitas untuk kode server (Section 64.13).
 * role dan memberId selalu dibaca dari database, tidak pernah dari klien.
 * Hasil cache hanya berlaku untuk satu request (React request cache).
 */
export const getActor = cache(async (): Promise<ActorContext | null> => {
  const db = await createServerClient();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) {
    console.log('[getActor] auth.getUser failed or no user:', authError?.message);
    return null;
  }

  const { createServiceRoleClient } = await import('@/infrastructure/supabase-server');
  const serviceDb = createServiceRoleClient();

  const [profileRes, memberRes] = await Promise.all([
    serviceDb.from('users').select('id, role').eq('id', auth.user.id).single(),
    serviceDb.from('members').select('id').eq('user_id', auth.user.id).maybeSingle()
  ]);

  if (profileRes.error || !profileRes.data) {
    console.log('[getActor] users select failed or no profile:', profileRes.error?.message, profileRes.error?.code);
    return null;
  }

  if (memberRes.error) {
    console.log('[getActor] members select error:', memberRes.error.message);
  }

  const profile = profileRes.data;
  const member = memberRes.data;

  console.log('[getActor] Success actor:', { userId: profile.id, role: profile.role, memberId: member?.id ?? null });
  return { userId: profile.id, role: profile.role, memberId: member?.id ?? null };
});

export async function requireActor(allowed: ActorContext['role'][]): Promise<ActorContext> {
  const actor = await getActor();
  if (!actor) {
    console.log('[requireActor] No actor found, redirecting to /login');
    redirect('/login');
  }
  if (!allowed.includes(actor.role)) {
    console.log('[requireActor] Role mismatch:', actor.role, 'allowed:', allowed, 'redirecting based on role...');
    if (actor.role === 'ADMIN') redirect('/admin');
    if (actor.role === 'GROOMER') redirect('/groomer');
    redirect('/home');
  }
  return actor;
}
