import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { resolveAttendanceAction } from './actions';

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

  return (
    <div>
      <div className="top" style={{ marginBottom: '24px' }}>
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Today's Schedule</b>
          <span>Admin Operations</span>
        </div>
        <Link href="/admin" className="bell">
          <i></i>🏠
        </Link>
      </div>

      {!slots || slots.length === 0 ? (
        <div className="card">
          <span style={{ color: 'var(--ink-2)' }}>No sessions scheduled for today.</span>
        </div>
      ) : (
        slots.map((slot: any) => {
          const activeBookings = slot.bookings.filter((b: any) => ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(b.status));
          const allParticipants = activeBookings.flatMap((b: any) => b.booking_participants);

          return (
            <div key={slot.id} className="card" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
                <b style={{ fontSize: '18px' }}>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</b>
                <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>{allParticipants.length} / {slot.capacity} Booked</span>
              </div>

              {allParticipants.length === 0 ? (
                <span style={{ fontSize: '14px', color: 'var(--ink-2)', fontStyle: 'italic' }}>No confirmed participants for this slot.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {allParticipants.map((p: any) => {
                    const hasAttendance = p.attendance_records && p.attendance_records.length > 0;
                    const attendanceStatus = hasAttendance ? p.attendance_records[0].status : null;

                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
                        <div>
                          <b style={{ fontSize: '14px', display: 'block' }}>
                            {p.participant_type === 'MEMBER' ? p.members?.full_name : p.casual_customers?.full_name}
                          </b>
                          <span style={{ fontSize: '12px', color: 'var(--ink-2)' }}>
                            {p.participant_type === 'MEMBER' ? 'Member' : 'Casual'}
                          </span>
                        </div>
                        
                        <div>
                          {hasAttendance ? (
                            <span className="chip-state" style={{ backgroundColor: attendanceStatus === 'ATTENDED' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)', color: attendanceStatus === 'ATTENDED' ? '#4CAF50' : '#F44336' }}>
                              {attendanceStatus}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <form action={resolveAttendanceAction.bind(null, p.id, 'ATTENDED', 'CONSUMED') as any}>
                                <button type="submit" className="btn" style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#4CAF50', color: 'white' }}>Attended</button>
                              </form>
                              <form action={resolveAttendanceAction.bind(null, p.id, 'NO_SHOW', 'CONSUMED') as any}>
                                <button type="submit" className="btn" style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'transparent', border: '1px solid var(--ink-3)', color: 'var(--ink-1)' }}>No Show</button>
                              </form>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
