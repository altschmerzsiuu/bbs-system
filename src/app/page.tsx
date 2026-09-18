import { redirect } from 'next/navigation';
import { getActor } from '@/lib/auth';

export default async function RootPage() {
  const actor = await getActor();
  if (!actor) redirect('/login');

  if (actor.role === 'ADMIN')   redirect('/admin');
  if (actor.role === 'GROOMER') redirect('/groomer');
  redirect('/home');
}
