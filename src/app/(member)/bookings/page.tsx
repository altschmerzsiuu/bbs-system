import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { BookingCard } from './booking-card';

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    full: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    day:  d.getDate(),
    mon:  MONTHS[d.getMonth()],
  };
}

const UPCOMING_STATUSES = new Set(['PENDING','CONFIRMED','RESCHEDULE_REQUESTED']);

export default async function BookingsPage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const { data: bookings } = await db
    .from('booking_participants')
    .select(`
      booking_id,
      bookings!inner (
        id, status, created_at, created_by,
        session_slots!inner ( slot_date, start_time, end_time )
      )
    `)
    .eq('member_id', actor.memberId!)
    .order('booking_id', { ascending: false });

  const list: any[] = (bookings ?? []).map((b: any) => b.bookings);
  const upcoming = list.filter(b => UPCOMING_STATUSES.has(b.status));
  const past     = list.filter(b => !UPCOMING_STATUSES.has(b.status));

  return (
    <div>
      <div className="top">
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>My rides</b>
          <span>Riwayat berkuda kamu</span>
        </div>
        <Link href="/notifications" className="bell">
          <i></i>🔔
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="note" style={{ textAlign: 'center', marginTop: '20px' }}>
          Belum ada riwayat booking.
          <Link href="/schedule">
            <button className="btn gold" style={{ marginTop: '12px' }}>Book a ride</button>
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div className="sec">
                <h3>Mendatang</h3>
              </div>
              {upcoming.map((booking: any) => (
                <BookingCard key={booking.id} booking={booking} isOwner={booking.created_by === actor.userId} />
              ))}
            </>
          )}

          {past.length > 0 && (
            <>
              <div className="sec">
                <h3>Sebelumnya</h3>
              </div>
              {past.map((booking: any) => (
                <BookingCard key={booking.id} booking={booking} isOwner={booking.created_by === actor.userId} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
