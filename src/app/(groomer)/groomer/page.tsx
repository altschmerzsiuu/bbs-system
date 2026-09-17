import React from 'react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { resolveAttendanceAction, assignHorseAction } from './actions';

export default async function GroomerDashboardPage() {
  await requireActor(['GROOMER', 'ADMIN']);
  const db = await createServerClient();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const { data: horses } = await db.from('horses').select('*').eq('status', 'ACTIVE').order('name');
  
  const { data: slots } = await db
    .from('session_slots')
    .select(`
      id, slot_date, start_time, capacity,
      bookings (
        id, status, is_casual,
        booking_participants (
          id, participant_type, horse_id,
          members (full_name),
          casual_customers (full_name),
          attendance_records (id, status)
        )
      )
    `)
    .eq('slot_date', today)
    .order('start_time');

  const safeSlots = slots || [];

  return (
    <div>
      <div className="top" style={{ marginBottom: '24px' }}>
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Field Operations 🐴</b>
          <span>{today}</span>
        </div>
      </div>

      {safeSlots.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-3)' }}>
          No sessions scheduled for today.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {safeSlots.map((slot) => {
            const activeBookings = slot.bookings.filter(b => ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(b.status));
            if (activeBookings.length === 0) return null;

            return (
              <div key={slot.id} className="card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <b style={{ fontSize: '20px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '12px', width: '100%' }}>
                  {slot.start_time.slice(0, 5)}
                </b>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {activeBookings.map((b) => (
                    b.booking_participants.map((p) => {
                      const name = p.participant_type === 'MEMBER' 
                        ? p.members?.full_name 
                        : p.casual_customers?.full_name;
                      
                      const attendance = p.attendance_records?.[0];
                      
                      return (
                        <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'var(--ink-5)', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b style={{ fontSize: '16px' }}>{name}</b>
                            <span className="chip-state" style={{ backgroundColor: p.participant_type === 'MEMBER' ? 'rgba(33,150,243,0.1)' : 'rgba(255,152,0,0.1)', color: p.participant_type === 'MEMBER' ? '#2196F3' : '#FF9800' }}>
                              {p.participant_type}
                            </span>
                          </div>

                          {/* HORSE ASSIGNMENT */}
                          <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--line)' }}>
                            <b style={{ fontSize: '12px', color: 'var(--ink-2)', display: 'block', marginBottom: '8px' }}>HORSE ASSIGNMENT</b>
                            <form action={assignHorseAction.bind(null, p.id) as any} style={{ display: 'flex', gap: '8px' }}>
                              <select 
                                name="horseId" 
                                defaultValue={p.horse_id || 'UNASSIGN'}
                                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '14px', backgroundColor: 'var(--ink-5)' }}
                              >
                                <option value="UNASSIGN">-- Select Horse --</option>
                                {horses?.map(h => (
                                  <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                              </select>
                              <button type="submit" className="btn" style={{ padding: '8px 16px' }}>Set</button>
                            </form>
                          </div>

                          {/* ATTENDANCE */}
                          <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--line)' }}>
                            <b style={{ fontSize: '12px', color: 'var(--ink-2)', display: 'block', marginBottom: '8px' }}>ATTENDANCE</b>
                            {attendance ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: attendance.status === 'ATTENDED' ? '#4CAF50' : '#F44336' }}>
                                <b>{attendance.status}</b>
                                <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>Recorded</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <form action={resolveAttendanceAction.bind(null, p.id, 'ATTENDED') as any} style={{ flex: 1 }}>
                                  <button type="submit" className="btn" style={{ width: '100%', backgroundColor: '#4CAF50', color: 'white', padding: '12px' }}>Attended</button>
                                </form>
                                <form action={resolveAttendanceAction.bind(null, p.id, 'NO_SHOW') as any} style={{ flex: 1 }}>
                                  <button type="submit" className="btn" style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--ink-3)', color: 'var(--ink-1)', padding: '12px' }}>No Show</button>
                                </form>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
