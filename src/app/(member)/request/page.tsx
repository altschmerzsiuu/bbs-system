import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import RequestForm from './request-form';
import { ensureSlotsForDateRange } from '@/modules/bookings/booking-queries';

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const actor = await requireActor(['MEMBER']);
  const db = await createServerClient();
  
  const params = await searchParams;
  const type = params.type === 'membership' ? 'MEMBERSHIP_APPLICATION' : 
               params.type === 'joyride' ? 'JOY_RIDE' : 
               'CASUAL_RIDE';

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  await ensureSlotsForDateRange(today.toISOString().split('T')[0], nextWeek.toISOString().split('T')[0]);

  const [
    { data: member },
    { data: plans },
    { data: slots }
  ] = await Promise.all([
    db.from('members').select('*').eq('id', actor.memberId).single(),
    db.from('membership_plans').select('*').eq('is_active', true).order('price_idr', { ascending: false }),
    db.from('session_slots').select('*').gte('slot_date', today.toISOString().split('T')[0]).order('slot_date').order('start_time')
  ]);

  return (
    <RequestForm 
      initialData={member || {}} 
      plans={plans || []} 
      slots={slots || []} 
      initialMode={type}
    />
  );
}
