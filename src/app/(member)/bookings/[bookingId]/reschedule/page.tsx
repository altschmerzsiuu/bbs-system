import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { RescheduleClient } from './reschedule-client';
import { notFound } from 'next/navigation';

export default async function ReschedulePage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const actor = await requireActor(['MEMBER']);
  const db = await createServerClient();

  // Load existing booking
  const { data: booking } = await db
    .from('bookings')
    .select(`
      id, status, created_by,
      session_slots!bookings_slot_id_fkey!inner ( id, slot_date, start_time, end_time )
    `)
    .eq('id', bookingId)
    .single();

  if (!booking) notFound();

  // Authorize owner
  if (booking.created_by !== actor.userId) {
    return <div>Anda tidak memiliki akses untuk mereschedule booking ini.</div>;
  }
  
  if (booking.status !== 'CONFIRMED') {
    return <div>Booking ini tidak dapat di-reschedule (Status: {booking.status}).</div>;
  }

  // Load available slots
  const today = new Date().toISOString().slice(0, 10);
  const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: slots } = await db
    .from('session_slots')
    .select(`
      id, slot_date, start_time, end_time, capacity, is_open,
      bookings!bookings_slot_id_fkey(id, status, booking_participants(id))
    `)
    .gte('slot_date', today)
    .lte('slot_date', next7Days)
    .eq('is_open', true)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

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

  return <RescheduleClient booking={booking} initialSlots={mappedSlots} />;
}
