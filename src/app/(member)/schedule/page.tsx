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

  const [slotsData, { data: settings }] = await Promise.all([
    (async () => {
      await ensureSlotsForDateRange(today, next7Days);
      const { data } = await db.from('session_slots')
        .select(`
          id, slot_date, start_time, end_time, capacity, is_open,
          bookings!bookings_slot_id_fkey(id, status, booking_participants(id, member_id))
        `)
        .gte('slot_date', today)
        .lte('slot_date', next7Days)
        .eq('is_open', true)
        .order('slot_date', { ascending: true })
        .order('start_time', { ascending: true });
      return data;
    })(),
    db.from('site_settings').select('admin_whatsapp, photographer_enabled, cancellation_hours').eq('id', 1).single()
  ]);

  const slots = slotsData;

  const mappedSlots = (slots ?? []).map((s: any) => {
    let count = 0;
    let isUserBooked = false;
    const activeBookings = s.bookings?.filter((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING' || b.status === 'RESCHEDULE_REQUESTED') || [];
    for (const b of activeBookings) {
      count += (b.booking_participants?.length || 0);
      if (b.booking_participants?.some((p: any) => p.member_id === actor.memberId)) {
        isUserBooked = true;
      }
    }
    return {
      id: s.id,
      slot_date: s.slot_date,
      start_time: s.start_time,
      end_time: s.end_time,
      capacity: s.capacity,
      booked_count: count,
      status: s.is_open ? 'OPEN' : 'CLOSED',
      is_user_booked: isUserBooked
    };
  });

  return (
    <ScheduleClient 
      initialSlots={mappedSlots} 
      memberName={actor.fullName ?? 'Rider'} 
      adminWa={settings?.admin_whatsapp || '6281234567890'} 
      photographerEnabled={settings?.photographer_enabled !== false}
      cancellationHours={settings?.cancellation_hours || 8}
    />
  );
}

