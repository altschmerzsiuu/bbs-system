import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { ChevronLeft } from 'lucide-react';
import { resolveAttendanceAction } from './actions'; // Kept in case we want to add attendance back to this view

export default async function AdminSchedulePage() {
  await requireActor(['ADMIN']);
  const db = await createServerClient();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const { data: slots } = await db
    .from('session_slots')
    .select(`
      *,
      bookings(
        id, status,
        booking_participants(
          id, participant_type,
          members(full_name),
          casual_customers(full_name),
          attendance_records(id, status)
        )
      )
    `)
    .eq('slot_date', today)
    .order('start_time', { ascending: true });

  const formatTime = (timeStr: string) => timeStr.slice(0, 5);
  const displayDate = new Date(today).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="top" style={{ marginBottom: '24px' }}>
        <Link href="/admin" className="icon" style={{ textDecoration: 'none' }}>
          <ChevronLeft size={20} strokeWidth={2} />
        </Link>
        <div className="topmain">
          <h2>Today's Schedule</h2>
          <span>{displayDate}</span>
        </div>
      </div>

      {!slots || slots.length === 0 ? (
        <div className="card" style={{ justifyContent: 'center' }}>
          <span className="sub">No sessions scheduled for today.</span>
        </div>
      ) : (
        slots.map((slot: any) => {
          const activeBookings = slot.bookings.filter((b: any) => ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(b.status));
          const allParticipants = activeBookings.flatMap((b: any) => b.booking_participants);
          const isFull = allParticipants.length >= slot.capacity;

          return (
            <div key={slot.id} className={`slot ${isFull ? 'full' : ''}`} style={{ marginBottom: '12px' }}>
              <div className="slottime">{formatTime(slot.start_time)}</div>
              <div className="slotmain">
                <b>{allParticipants.length} rider{allParticipants.length !== 1 ? 's' : ''}</b>
                Arena 01
              </div>
              <span className={`pill ${isFull ? 'no' : 'ok'}`}>
                {isFull ? 'Full' : 'Open'}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
