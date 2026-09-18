import { getMemberHome } from '@/modules/bookings/booking-queries';
import { requireActor } from '@/lib/auth';
import { FCMRegistrar } from '@/modules/notifications/components/fcm-registrar';
import { HomeClient } from './home-client';

export default async function MemberHomePage() {
  const actor = await requireActor(['MEMBER']);
  
  const { createServerClient } = await import('@/infrastructure/supabase-server');
  const db = await createServerClient();
  
  // Fetch getMemberHome and user data in parallel
  const [data, { data: user }] = await Promise.all([
    getMemberHome(actor.memberId!),
    db.from('users').select('avatar_url').eq('id', actor.userId).single()
  ]);

  return (
    <>
      <FCMRegistrar />
      <HomeClient data={data} avatarUrl={user?.avatar_url || ''} />
    </>
  );
}
