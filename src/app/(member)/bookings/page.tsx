import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { BookingCard } from './booking-card';

const UPCOMING_STATUSES = new Set(['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED']);

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

  const list: any[]     = (bookings ?? []).map((b: any) => b.bookings);
  const upcoming        = list.filter(b => UPCOMING_STATUSES.has(b.status));
  const past            = list.filter(b => !UPCOMING_STATUSES.has(b.status));

  return (
    <div>
      {/* ── Top ── */}
      <div className="top">
        <div className="topmain">
          <h2>My Rides</h2>
          <span className="sub">Your riding journey</span>
        </div>
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--goldSoft)', marginBottom: '12px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>No rides yet</div>
          <div className="sub" style={{ marginBottom: '20px' }}>Book your first session at the stable.</div>
          <Link href="/schedule">
            <button className="primary" style={{ maxWidth: '220px', margin: '0 auto' }}>Book a Ride →</button>
          </Link>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="filters">
            <button className="filter active">Upcoming</button>
            <button className="filter">Completed</button>
            <button className="filter">Cancelled</button>
          </div>

          {upcoming.length > 0 && (
            <div className="list">
              {upcoming.map((booking: any) => (
                <BookingCard key={booking.id} booking={booking} isOwner={booking.created_by === actor.userId} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <>
              <div className="section" style={{ marginTop: '24px' }}>
                <b>Past Rides</b>
              </div>
              <div className="list">
                {past.map((booking: any) => (
                  <BookingCard key={booking.id} booking={booking} isOwner={booking.created_by === actor.userId} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
