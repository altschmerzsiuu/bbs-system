import { redirect } from 'next/navigation';
import { createServerClient } from '@/infrastructure/supabase-server';
import type { ActorContext } from '@/modules/bookings/booking-service';

/**
 * Satu-satunya sumber identitas untuk kode server (Section 64.13).
 * role dan memberId selalu dibaca dari database, tidak pernah dari klien.
 */
export async function getActor(): Promise<ActorContext | null> {
  const db = await createServerClient();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) {
    console.log('[getActor] auth.getUser failed or no user:', authError?.message);
    return null;
  }

  const { createServiceRoleClient } = await import('@/infrastructure/supabase-server');
  const serviceDb = createServiceRoleClient();

  const { data: profile, error: profileErr } = await serviceDb
    .from('users').select('id, role').eq('id', auth.user.id).single();
  if (profileErr || !profile) {
    console.log('[getActor] users select failed or no profile:', profileErr?.message, profileErr?.code);
    return null;
  }

  const { data: member, error: memberErr } = await serviceDb
    .from('members').select('id').eq('user_id', auth.user.id).maybeSingle();

  if (memberErr) {
    console.log('[getActor] members select error:', memberErr.message);
  }

  console.log('[getActor] Success actor:', { userId: profile.id, role: profile.role, memberId: member?.id ?? null });
  return { userId: profile.id, role: profile.role, memberId: member?.id ?? null };
}

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
