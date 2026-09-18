import React from 'react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { resolveAttendanceAction, assignHorseAction } from './actions';
import { LogOut } from 'lucide-react';
import { createClient } from '@supabase/supabase-js'; // We won't use it directly here for signout since this is server component, so we use a client component or link

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
        <div className="topmain">
          <h2>Field Operations<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Groomer.</em></h2>
          <span className="sub">{new Date(today).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {safeSlots.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--goldSoft)', marginBottom: '12px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>No sessions today</div>
          <div className="sub">Enjoy your free time!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {safeSlots.map((slot) => {
            const activeBookings = slot.bookings.filter(b => ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(b.status));
            if (activeBookings.length === 0) return null;

            return (
              <div key={slot.id} className="card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <b style={{ fontFamily: 'var(--font-display)', fontSize: '24px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '12px', width: '100%', color: 'var(--gold)' }}>
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
                        <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: '#fcfcfb', borderRadius: '12px', border: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b style={{ fontSize: '16px' }}>{name}</b>
                            <span className={`pill ${p.participant_type === 'MEMBER' ? 'wait' : 'ok'}`}>
                              {p.participant_type}
                            </span>
                          </div>

                          {/* HORSE ASSIGNMENT */}
                          <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--line)' }}>
                            <b style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>HORSE ASSIGNMENT</b>
                            <form action={assignHorseAction.bind(null, p.id) as any} style={{ display: 'flex', gap: '8px' }}>
                              <select 
                                name="horseId" 
                                defaultValue={p.horse_id || 'UNASSIGN'}
                                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13px', backgroundColor: '#fcfcfb', fontFamily: 'var(--font-body)' }}
                              >
                                <option value="UNASSIGN">-- Select Horse --</option>
                                {horses?.map(h => (
                                  <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                              </select>
                              <button type="submit" className="btn gold" style={{ margin: 0, padding: '8px 16px' }}>Set</button>
                            </form>
                          </div>

                          {/* ATTENDANCE */}
                          <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--line)' }}>
                            <b style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>ATTENDANCE</b>
                            {attendance ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: attendance.status === 'ATTENDED' ? 'var(--green)' : 'var(--red)' }}>
                                <b>{attendance.status}</b>
                                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Recorded</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <form action={resolveAttendanceAction.bind(null, p.id, 'ATTENDED') as any} style={{ flex: 1 }}>
                                  <button type="submit" className="btn" style={{ width: '100%', backgroundColor: 'var(--greenSoft)', color: 'var(--green)', margin: 0 }}>Attended</button>
                                </form>
                                <form action={resolveAttendanceAction.bind(null, p.id, 'NO_SHOW') as any} style={{ flex: 1 }}>
                                  <button type="submit" className="btn" style={{ width: '100%', backgroundColor: 'var(--redSoft)', color: 'var(--red)', margin: 0 }}>No Show</button>
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
