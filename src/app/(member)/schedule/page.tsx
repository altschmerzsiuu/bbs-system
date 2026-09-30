export const dynamic = 'force-dynamic';
import { ensureSlotsForDateRange } from '@/modules/bookings/booking-queries';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { ScheduleClient } from './schedule-client';

export default async function SchedulePage() {
  const actor = await requireActor(['MEMBER']);
  const db = await createServerClient();

  const today = new Date().toISOString().slice(0, 10);
  const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await ensureSlotsForDateRange(today, next7Days);

  const [
    { data: member },
    { data: slots }
  ] = await Promise.all([
    db.from('members').select('full_name').eq('id', actor.memberId!).single(),
    db.from('session_slots')
      .select(`
        id, slot_date, start_time, end_time, capacity, is_open,
        bookings!bookings_slot_id_fkey(id, status, booking_participants(id))
      `)
      .gte('slot_date', today)
      .lte('slot_date', next7Days)
      .eq('is_open', true)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
  ]);

  const mappedSlots = (slots ?? []).map((s: any) => {
    let count = 0;
    const activeBookings = s.bookings?.filter((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING' || b.status === 'RESCHEDULE_REQUESTED') || [];
    for (const b of activeBookings) {
      count += (b.booking_participants?.length || 0);
    }
    return {
      id: s.id,
      slot_date: s.slot_date,
      start_time: s.start_time,
      end_time: s.end_time,
      capacity: s.capacity,
      booked_count: count,
      status: s.is_open ? 'OPEN' : 'CLOSED'
    };
  });

  return <ScheduleClient initialSlots={mappedSlots} memberName={member?.full_name ?? 'Rider'} />;
}
