import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { RescheduleClient } from './reschedule-client';
import { notFound } from 'next/navigation';

export default async function ReschedulePage({ params }: { params: { bookingId: string } }) {
  const actor = await requireActor(['MEMBER']);
  const db = await createServerClient();

  // Load existing booking
  const { data: booking } = await db
    .from('bookings')
    .select(`
      id, status, created_by,
      session_slots!inner ( id, slot_date, start_time, end_time )
    `)
    .eq('id', params.bookingId)
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
    .select('id, slot_date, start_time, end_time, capacity, booked_count, status')
    .gte('slot_date', today)
    .lte('slot_date', next7Days)
    .eq('status', 'OPEN')
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  return <RescheduleClient booking={booking} initialSlots={slots ?? []} />;
}
