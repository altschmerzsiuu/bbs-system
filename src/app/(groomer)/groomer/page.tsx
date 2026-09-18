import React from 'react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { resolveAttendanceAction, assignHorseAction } from './actions';
import { Bell, Check } from 'lucide-react';
import Link from 'next/link';

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
  
  // Flatten active participants for the groomer view
  const activeSessions = safeSlots.map(slot => {
    const activeBookings = slot.bookings.filter(b => ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(b.status));
    const participants = activeBookings.flatMap(b => b.booking_participants);
    return {
      ...slot,
      participants
    };
  }).filter(s => s.participants.length > 0);

  const totalSessions = activeSessions.length;
  const preppedSessions = activeSessions.filter(s => s.participants.every(p => p.horse_id != null)).length;
  const progressPercent = totalSessions === 0 ? 0 : Math.round((preppedSessions / totalSessions) * 100);

  const nextSession = activeSessions.find(s => s.participants.some(p => p.horse_id == null)) || activeSessions[0];

  return (
    <div>
      <div className="top">
        <div className="avatar initial" style={{ background: '#dfe6da' }}>GR</div>
        <div className="topmain">
          <b>Good morning.</b>
          <span>Stable team · {new Date().toLocaleDateString('en-GB', { weekday: 'long' })}</span>
        </div>
        <button className="icon" aria-label="Notifications">
          <Bell size={18} strokeWidth={2} color="var(--ink)" />
        </button>
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <b>Prep progress</b>
        <span className="sub">{preppedSessions} of {totalSessions} ready</span>
      </div>
      <div className="progress" style={{ marginBottom: '18px' }}>
        <i style={{ width: `${progressPercent}%` }}></i>
      </div>

      {nextSession ? (
        <div className="groomHero">
          <span className="eyebrow">NEXT SESSION</span>
          <div className="big">{nextSession.start_time.slice(0, 5)}</div>
          <div className="sub">{nextSession.participants.length} riders · Arena 01</div>
          <button className="primary" style={{ marginTop: '13px', width: 'auto', padding: '0 20px' }}>
            Prepare session →
          </button>
          <img className="groomHorse" src="https://images.unsplash.com/photo-1598974357801-cbca100e65d0?auto=format&fit=crop&w=900&q=80" alt="Horse" />
        </div>
      ) : (
        <div className="groomHero">
          <span className="eyebrow">NO SESSIONS TODAY</span>
          <div className="big">Enjoy!</div>
        </div>
      )}

      <div className="section">
        <b>Today's sessions</b>
        <a style={{ fontSize: '8px', color: 'var(--gold)', fontWeight: 800, cursor: 'pointer' }}>See all</a>
      </div>

      {activeSessions.map((slot, i) => {
        const isPrepped = slot.participants.every(p => p.horse_id != null);
        const participantNames = slot.participants.map(p => 
          p.participant_type === 'MEMBER' ? p.members?.full_name : p.casual_customers?.full_name
        ).join(' · ');

        return (
          <div key={slot.id} className={`checkrow ${isPrepped ? 'done' : ''}`}>
            <div className="checkdot">
              {isPrepped ? (
                <Check size={14} strokeWidth={2.5} color="white" />
              ) : (
                <span style={{ fontSize: '7px', color: '#b6b4ab', fontWeight: 800 }}>{i + 1}</span>
              )}
            </div>
            <div className="rowmain">
              <b>{slot.start_time.slice(0, 5)} · {slot.participants.length} rider{slot.participants.length !== 1 ? 's' : ''}</b>
              <span>{participantNames} · Arena 01</span>
            </div>
            <span className={`pill ${isPrepped ? 'ok' : 'wait'}`}>
              {isPrepped ? 'Prepped' : 'Pending'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
