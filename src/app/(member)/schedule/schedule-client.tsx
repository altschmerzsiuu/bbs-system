'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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

const DAYS_SHORT  = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export function ScheduleClient({ initialSlots }: { initialSlots: Slot[] }) {
  const availableDates = Array.from(new Set(initialSlots.map(s => s.slot_date))).sort();
  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates[0] || new Date().toISOString().slice(0, 10)
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  
  // Participants
  const [participants, setParticipants] = useState<ParticipantState[]>([{ type: 'MEMBER', memberId: 'me', name: 'Me' }]);
  const [addMode, setAddMode] = useState<'NONE' | 'MEMBER' | 'CASUAL'>('NONE');
  const [memberEmail, setMemberEmail] = useState('');
  const [casualName, setCasualName] = useState('');
  const [casualPhone, setCasualPhone] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState<{ ok: boolean; message: string } | null>(null);

  const slotsForDate   = initialSlots.filter(s => s.slot_date === selectedDate);
  const morningSlots   = slotsForDate.filter(s => s.start_time.slice(0, 2) < '12');
  const afternoonSlots = slotsForDate.filter(s => s.start_time.slice(0, 2) >= '12');

  const handleBook = async () => {
    if (!selectedSlotId) return;
    setLoading(true);
    setResult(null);

    // Format payload for backend
    // Note: 'me' is handled in the server action if memberId is not provided, 
    // but the backend expects proper formatting for other participants.
    // However, the action now accepts stringified JSON and uses the primary actor's memberId automatically if missing.
    // For simplicity, we just send all participants as-is, and the server action will map 'me' to the actor.
    const payload = participants.map(p => {
      if (p.type === 'MEMBER') return { type: 'MEMBER', memberId: p.memberId };
      return { type: 'CASUAL', fullName: p.fullName, phone: p.phone };
    });

    const res = await submitBooking(selectedSlotId, JSON.stringify(payload));
    setLoading(false);
    if (res.ok) {
      setResult({ ok: true, message: 'Booking dikirim! Menunggu konfirmasi admin.' });
      setSelectedSlotId(null);
      setParticipants([{ type: 'MEMBER', memberId: 'me', name: 'Me' }]);
    } else {
      setResult({ ok: false, message: res.message || 'Booking gagal. Silakan coba lagi.' });
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
        setLookupError('Member ini sudah ditambahkan.');
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
    if (!casualName || !casualPhone) {
      setLookupError('Nama dan No. HP wajib diisi');
      return;
    }
    setParticipants([...participants, { type: 'CASUAL', fullName: casualName, phone: casualPhone, name: casualName }]);
    setAddMode('NONE');
    setCasualName('');
    setCasualPhone('');
  };

  return (
    <div>
      <div className="top">
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Schedule</b>
          <span>Pilih Sesi Berkuda</span>
        </div>
        <Link href="/notifications" className="bell">
          <i></i>🔔
        </Link>
      </div>

      {result && (
        <div className="note" style={{ marginBottom: '14px', background: result.ok ? 'var(--sage-soft)' : 'var(--clay-soft)', color: 'var(--ink)' }}>
          {result.message}
        </div>
      )}

      <div className="week">
        {availableDates.map(date => {
          const d = new Date(`${date}T00:00:00`);
          const isSelected = selectedDate === date;
          return (
            <div
              key={date}
              className={`day ${isSelected ? 'on' : ''}`}
              onClick={() => { setSelectedDate(date); setSelectedSlotId(null); }}
            >
              <span>{DAYS_SHORT[d.getDay()]}</span>
              <b>{d.getDate()}</b>
              {isSelected && <i />}
            </div>
          );
        })}
      </div>

      <div className="sec">
        <h3>Pagi</h3>
        <a>07:00 — 11:00</a>
      </div>
      {morningSlots.map(slot => {
        const isSelected = selectedSlotId === slot.id;
        const remaining  = slot.capacity - slot.booked_count;
        const isFull     = remaining <= 0;
        return (
          <div
            key={slot.id}
            className={`slot ${isFull ? 'full' : ''}`}
            style={isSelected ? { borderColor: 'var(--gold)', background: 'var(--gold-soft)' } : {}}
            onClick={() => !isFull && setSelectedSlotId(slot.id)}
          >
            <b>{slot.start_time.slice(0, 5)}</b>
            <div className="meta">{isFull ? 'Penuh' : `${remaining} tempat tersisa`}</div>
            <div className="dots">
              <i className={remaining < 1 ? 'empty' : ''} />
              <i className={remaining < 2 ? 'empty' : ''} />
            </div>
          </div>
        );
      })}

      <div className="sec">
        <h3>Sore</h3>
        <a>13:00 — 18:00</a>
      </div>
      {afternoonSlots.map(slot => {
        const isSelected = selectedSlotId === slot.id;
        const remaining  = slot.capacity - slot.booked_count;
        const isFull     = remaining <= 0;
        return (
          <div
            key={slot.id}
            className={`slot ${isFull ? 'full' : ''}`}
            style={isSelected ? { borderColor: 'var(--gold)', background: 'var(--gold-soft)' } : {}}
            onClick={() => !isFull && setSelectedSlotId(slot.id)}
          >
            <b>{slot.start_time.slice(0, 5)}</b>
            <div className="meta">{isFull ? 'Penuh' : `${remaining} tempat tersisa`}</div>
            <div className="dots">
              <i className={remaining < 1 ? 'empty' : ''} />
              <i className={remaining < 2 ? 'empty' : ''} />
            </div>
          </div>
        );
      })}

      {selectedSlotId && (
        <div className="sec" style={{ marginTop: '24px' }}>
          <h3>Participants</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {participants.map((p, i) => (
              <div key={i} className="card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <b>{p.name}</b>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink-2)' }}>{p.type === 'MEMBER' ? 'Member (Menggunakan kredit sendiri)' : 'Casual (Pembayaran terpisah)'}</span>
                </div>
                {p.type !== 'MEMBER' || p.memberId !== 'me' ? (
                  <button 
                    style={{ background: 'none', border: 'none', color: 'var(--cherry)', fontSize: '12px' }}
                    onClick={() => setParticipants(participants.filter((_, idx) => idx !== i))}
                  >
                    Hapus
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {addMode === 'NONE' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="btn" style={{ flex: 1, backgroundColor: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--cloud)' }} onClick={() => setAddMode('MEMBER')}>+ Member</button>
              <button className="btn" style={{ flex: 1, backgroundColor: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--cloud)' }} onClick={() => setAddMode('CASUAL')}>+ Casual</button>
            </div>
          )}

          {addMode === 'MEMBER' && (
            <div className="card" style={{ flexDirection: 'column', marginTop: '12px', alignItems: 'stretch' }}>
              <b>Tambah Member</b>
              <input type="email" placeholder="Email member" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} style={{ padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid var(--cloud)' }} />
              {lookupError && <span style={{ color: 'var(--cherry)', fontSize: '12px', marginTop: '4px' }}>{lookupError}</span>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button className="btn" style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--ink)' }} onClick={() => setAddMode('NONE')}>Batal</button>
                <button className="btn gold" style={{ flex: 1 }} onClick={handleAddMember} disabled={lookupLoading}>{lookupLoading ? 'Mencari...' : 'Tambah'}</button>
              </div>
            </div>
          )}

          {addMode === 'CASUAL' && (
            <div className="card" style={{ flexDirection: 'column', marginTop: '12px', alignItems: 'stretch' }}>
              <b>Tambah Casual</b>
              <input type="text" placeholder="Nama Lengkap" value={casualName} onChange={e => setCasualName(e.target.value)} style={{ padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid var(--cloud)' }} />
              <input type="tel" placeholder="No. HP" value={casualPhone} onChange={e => setCasualPhone(e.target.value)} style={{ padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid var(--cloud)' }} />
              {lookupError && <span style={{ color: 'var(--cherry)', fontSize: '12px', marginTop: '4px' }}>{lookupError}</span>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button className="btn" style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--ink)' }} onClick={() => setAddMode('NONE')}>Batal</button>
                <button className="btn gold" style={{ flex: 1 }} onClick={handleAddCasual}>Tambah</button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        disabled={!selectedSlotId || loading}
        onClick={handleBook}
        className="btn gold"
        style={{ marginTop: '18px', opacity: !selectedSlotId || loading ? 0.5 : 1, width: '100%' }}
      >
        {loading ? 'Mengirim...' : 'Konfirmasi Booking'}
      </button>
    </div>
  );
}
