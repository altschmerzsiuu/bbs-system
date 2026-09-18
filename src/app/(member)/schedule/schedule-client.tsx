'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { submitBooking, lookupMemberByEmail } from './actions';

type ParticipantState =
  | { type: 'MEMBER'; memberId: string; name: string }
  | { type: 'CASUAL'; fullName: string; phone: string; name: string };

interface Slot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
}

const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function ScheduleClient({ initialSlots }: { initialSlots: Slot[] }) {
  const availableDates = Array.from(new Set(initialSlots.map(s => s.slot_date))).sort();
  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates[0] || new Date().toISOString().slice(0, 10)
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [participants, setParticipants] = useState<ParticipantState[]>([{ type: 'MEMBER', memberId: 'me', name: 'Me' }]);
  const [addMode,     setAddMode]     = useState<'NONE' | 'MEMBER' | 'CASUAL'>('NONE');
  const [memberEmail, setMemberEmail] = useState('');
  const [casualName,  setCasualName]  = useState('');
  const [casualPhone, setCasualPhone] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; message: string } | null>(null);

  const slotsForDate   = initialSlots.filter(s => s.slot_date === selectedDate);
  const morningSlots   = slotsForDate.filter(s => s.start_time.slice(0, 2) < '12');
  const afternoonSlots = slotsForDate.filter(s => s.start_time.slice(0, 2) >= '12');

  const handleBook = async () => {
    if (!selectedSlotId) return;
    setLoading(true);
    setResult(null);
    const payload = participants.map(p =>
      p.type === 'MEMBER'
        ? { type: 'MEMBER', memberId: p.memberId }
        : { type: 'CASUAL', fullName: p.fullName, phone: p.phone }
    );
    const res = await submitBooking(selectedSlotId, JSON.stringify(payload));
    setLoading(false);
    if (res.ok) {
      setResult({ ok: true, message: 'Booking submitted! Waiting for admin confirmation.' });
      setSelectedSlotId(null);
      setParticipants([{ type: 'MEMBER', memberId: 'me', name: 'Me' }]);
    } else {
      setResult({ ok: false, message: res.message || 'Booking failed. Please try again.' });
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail) return;
    setLookupLoading(true);
    setLookupError('');
    const res = await lookupMemberByEmail(memberEmail);
    setLookupLoading(false);
    if (res.ok) {
      if (participants.some(p => p.type === 'MEMBER' && p.memberId === res.memberId)) {
        setLookupError('Member already added.');
        return;
      }
      setParticipants([...participants, { type: 'MEMBER', memberId: res.memberId, name: res.fullName }]);
      setAddMode('NONE');
      setMemberEmail('');
    } else {
      setLookupError(res.message);
    }
  };

  const handleAddCasual = () => {
    if (!casualName || !casualPhone) { setLookupError('Name and phone number required'); return; }
    setParticipants([...participants, { type: 'CASUAL', fullName: casualName, phone: casualPhone, name: casualName }]);
    setAddMode('NONE');
    setCasualName('');
    setCasualPhone('');
  };

  return (
    <div>
      {/* ── Top ── */}
      <div className="top">
        <div className="topmain">
          <h2 style={{ fontSize: '28px', marginBottom: '2px' }}>Book a<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Ride.</em></h2>
          <span className="sub">Choose your date and time</span>
        </div>
      </div>

      {/* ── Result banner ── */}
      {result && (
        <div
          className="note"
          style={{
            marginBottom: '14px',
            background: result.ok ? 'var(--greenSoft)' : 'var(--redSoft)',
            color: result.ok ? 'var(--green)' : 'var(--red)',
          }}
        >
          {result.message}
        </div>
      )}

      {/* ── Week Calendar ── */}
      <div className="section" style={{ marginTop: '4px' }}>
        <b>{(() => { const d = new Date(`${selectedDate}T00:00:00`); return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; })()}</b>
        <span className="sub">Choose a day</span>
      </div>

      <div className="calendar">
        {availableDates.map(date => {
          const d = new Date(`${date}T00:00:00`);
          const isSelected = selectedDate === date;
          return (
            <div
              key={date}
              className={`day ${isSelected ? 'selected' : ''}`}
              onClick={() => { setSelectedDate(date); setSelectedSlotId(null); }}
            >
              {DAYS_SHORT[d.getDay()]}
              <b>{d.getDate()}</b>
            </div>
          );
        })}
      </div>

      {/* ── Morning Slots ── */}
      {morningSlots.length > 0 && (
        <>
          <div className="section" style={{ marginTop: '5px' }}>
            <b>Morning</b>
            <span className="sub">07:00 — 12:00</span>
          </div>
          {morningSlots.map(slot => {
            const isSelected = selectedSlotId === slot.id;
            const remaining  = slot.capacity - slot.booked_count;
            const isFull     = remaining <= 0;
            return (
              <div
                key={slot.id}
                className={`slot ${isFull ? 'full' : ''}`}
                style={isSelected ? { borderColor: 'var(--gold)', background: 'var(--goldSoft)' } : {}}
                onClick={() => !isFull && setSelectedSlotId(slot.id)}
              >
                <div className="slottime">{slot.start_time.slice(0, 5)}</div>
                <div className="slotmain">
                  <b>{isFull ? 'Full' : remaining === 1 ? '1 spot left' : 'Available'}</b>
                  {slot.booked_count}/{slot.capacity} riders
                </div>
                {!isFull && <ArrowRight size={16} strokeWidth={1.75} color="var(--muted)" />}
              </div>
            );
          })}
        </>
      )}

      {/* ── Afternoon Slots ── */}
      {afternoonSlots.length > 0 && (
        <>
          <div className="section">
            <b>Afternoon</b>
            <span className="sub">13:00 — 17:00</span>
          </div>
          {afternoonSlots.map(slot => {
            const isSelected = selectedSlotId === slot.id;
            const remaining  = slot.capacity - slot.booked_count;
            const isFull     = remaining <= 0;
            return (
              <div
                key={slot.id}
                className={`slot ${isFull ? 'full' : ''}`}
                style={isSelected ? { borderColor: 'var(--gold)', background: 'var(--goldSoft)' } : {}}
                onClick={() => !isFull && setSelectedSlotId(slot.id)}
              >
                <div className="slottime">{slot.start_time.slice(0, 5)}</div>
                <div className="slotmain">
                  <b>{isFull ? 'Full' : remaining === 1 ? '1 spot left' : 'Available'}</b>
                  {slot.booked_count}/{slot.capacity} riders
                </div>
                {!isFull && <ArrowRight size={16} strokeWidth={1.75} color="var(--muted)" />}
              </div>
            );
          })}
        </>
      )}

      {slotsForDate.length === 0 && (
        <div className="note" style={{ textAlign: 'center', marginTop: '20px' }}>
          No slots available for this date.
        </div>
      )}

      {/* ── Participants (when slot selected) ── */}
      {selectedSlotId && (
        <div style={{ marginTop: '24px' }}>
          <div className="section">
            <b>Riders</b>
          </div>

          <div className="list" style={{ marginBottom: '12px' }}>
            {participants.map((p, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {p.type === 'MEMBER' ? 'Member (uses own credit)' : 'Casual (separate payment)'}
                  </div>
                </div>
                {!(p.type === 'MEMBER' && p.memberId === 'me') && (
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '12px', cursor: 'pointer' }}
                    onClick={() => setParticipants(participants.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          {addMode === 'NONE' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn"
                style={{ flex: 1, background: '#efeee9', color: 'var(--ink)', marginTop: 0 }}
                onClick={() => setAddMode('MEMBER')}
              >
                + Member
              </button>
              <button
                className="btn"
                style={{ flex: 1, background: '#efeee9', color: 'var(--ink)', marginTop: 0 }}
                onClick={() => setAddMode('CASUAL')}
              >
                + Casual
              </button>
            </div>
          )}

          {addMode === 'MEMBER' && (
            <div className="card" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <b style={{ fontSize: '13px' }}>Add Member</b>
              <input
                type="email"
                placeholder="Member email"
                value={memberEmail}
                onChange={e => setMemberEmail(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', fontFamily: 'var(--font-body)', fontSize: '13px', width: '100%' }}
              />
              {lookupError && <span style={{ color: 'var(--red)', fontSize: '11px' }}>{lookupError}</span>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn" style={{ flex: 1, background: '#efeee9', color: 'var(--ink)', marginTop: 0 }} onClick={() => setAddMode('NONE')}>Cancel</button>
                <button className="btn gold" style={{ flex: 1, marginTop: 0 }} onClick={handleAddMember} disabled={lookupLoading}>
                  {lookupLoading ? 'Searching...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {addMode === 'CASUAL' && (
            <div className="card" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <b style={{ fontSize: '13px' }}>Add Casual Rider</b>
              <input
                type="text"
                placeholder="Full name"
                value={casualName}
                onChange={e => setCasualName(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', fontFamily: 'var(--font-body)', fontSize: '13px', width: '100%' }}
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={casualPhone}
                onChange={e => setCasualPhone(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--line)', fontFamily: 'var(--font-body)', fontSize: '13px', width: '100%' }}
              />
              {lookupError && <span style={{ color: 'var(--red)', fontSize: '11px' }}>{lookupError}</span>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn" style={{ flex: 1, background: '#efeee9', color: 'var(--ink)', marginTop: 0 }} onClick={() => setAddMode('NONE')}>Cancel</button>
                <button className="btn gold" style={{ flex: 1, marginTop: 0 }} onClick={handleAddCasual}>Add</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm Button ── */}
      <button
        disabled={!selectedSlotId || loading}
        onClick={handleBook}
        className="primary"
        style={{ marginTop: '20px', opacity: !selectedSlotId || loading ? 0.45 : 1 }}
      >
        {loading ? 'Submitting...' : 'Confirm Booking →'}
      </button>
    </div>
  );
}
