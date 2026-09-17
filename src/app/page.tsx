import { redirect } from 'next/navigation';
import { getActor } from '@/lib/auth';

/**
 * Root page: cek session dulu baru arahkan.
 * Kalau tidak ada session → /login, bukan langsung /home
 * (mencegah infinite redirect loop).
 */
export default async function RootPage() {
  const actor = await getActor();
  if (!actor) redirect('/login');

  // Route per role
  if (actor.role === 'ADMIN')   redirect('/admin');
  if (actor.role === 'GROOMER') redirect('/groomer');
  redirect('/home');
}
