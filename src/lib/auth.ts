import { redirect } from 'next/navigation';
import { createServerClient } from '@/infrastructure/supabase-server';
import type { ActorContext } from '@/modules/bookings/booking-service';

import { cache } from 'react';

/**
 * Satu-satunya sumber identitas untuk kode server (Section 64.13).
 * role dan memberId selalu dibaca dari database, tidak pernah dari klien.
 * Hasil cache hanya berlaku untuk satu request (React request cache).
 */
export const getActor = cache(async (strict: boolean = false): Promise<ActorContext | null> => {
  const db = await createServerClient();
  
  let user = null;
  if (strict) {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) {
      console.log('[getActor] auth.getUser failed or no user:', error?.message);
      return null;
    }
    user = data.user;
  } else {
    const { data, error } = await db.auth.getSession();
    if (error || !data.session?.user) {
      console.log('[getActor] auth.getSession failed or no user:', error?.message);
      return null;
    }
    user = data.session.user;
  }

  const { createServiceRoleClient } = await import('@/infrastructure/supabase-server');
  const serviceDb = createServiceRoleClient();

  const [profileRes, memberRes] = await Promise.all([
    serviceDb.from('users').select('id, role').eq('id', user.id).single(),
    serviceDb.from('members').select('id').eq('user_id', user.id).maybeSingle()
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

export async function requireActor(allowed: ActorContext['role'][], strict: boolean = false): Promise<ActorContext> {
  const actor = await getActor(strict);
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
