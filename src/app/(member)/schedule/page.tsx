import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { ScheduleClient } from './schedule-client';

export default async function SchedulePage() {
  await requireActor(['MEMBER']);
  const db = await createServerClient();

  const today = new Date().toISOString().slice(0, 10);
  const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: slots } = await db
    .from('session_slots')
    .select('id, slot_date, start_time, end_time, capacity, booked_count, status')
    .gte('slot_date', today)
    .lte('slot_date', next7Days)
    .eq('status', 'OPEN')
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  return <ScheduleClient initialSlots={slots ?? []} />;
}
