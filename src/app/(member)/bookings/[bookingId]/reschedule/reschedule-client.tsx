'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { requestRescheduleAction } from '../../actions';

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

export function RescheduleClient({ booking, initialSlots }: { booking: any; initialSlots: Slot[] }) {
  const availableDates = Array.from(new Set(initialSlots.map(s => s.slot_date))).sort();
  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates[0] || new Date().toISOString().slice(0, 10)
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);
  const [result, setResult]                 = useState<{ ok: boolean; message: string } | null>(null);

  const slotsForDate   = initialSlots.filter(s => s.slot_date === selectedDate);
  const morningSlots   = slotsForDate.filter(s => s.start_time.slice(0, 2) < '12');
  const afternoonSlots = slotsForDate.filter(s => s.start_time.slice(0, 2) >= '12');

  const handleReschedule = async () => {
    if (!selectedSlotId) return;
    setLoading(true);
    setResult(null);
    const res = await requestRescheduleAction(booking.id, selectedSlotId);
    setLoading(false);
    if (res.ok) {
      setResult({ ok: true, message: 'Permintaan reschedule dikirim! Menunggu konfirmasi admin.' });
      setSelectedSlotId(null);
    } else {
      setResult({ ok: false, message: res.message || 'Reschedule gagal. Silakan coba lagi.' });
    }
  };

  return (
    <div>
      <div className="top">
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Reschedule</b>
          <span>Pilih Jadwal Baru</span>
        </div>
        <Link href="/bookings" className="bell">
          ✕
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '16px', backgroundColor: 'var(--surface-2)', border: '1px solid var(--gold-deep)' }}>
        <b style={{ color: 'var(--gold-deep)' }}>Jadwal Lama</b>
        <div style={{ marginTop: '4px' }}>
          {booking.session_slots.slot_date} ({booking.session_slots.start_time.slice(0, 5)} - {booking.session_slots.end_time.slice(0, 5)})
        </div>
      </div>

      {result && (
        <div className="note" style={{ marginBottom: '14px', background: result.ok ? 'var(--sage-soft)' : 'var(--clay-soft)', color: 'var(--ink)' }}>
          {result.message}
          {result.ok && (
            <Link href="/bookings" style={{ display: 'block', marginTop: '8px', textDecoration: 'underline' }}>
              Kembali ke My Rides
            </Link>
          )}
        </div>
      )}

      {!result?.ok && (
        <>
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

          <button
            disabled={!selectedSlotId || loading}
            onClick={handleReschedule}
            className="btn gold"
            style={{ marginTop: '18px', opacity: !selectedSlotId || loading ? 0.5 : 1, width: '100%' }}
          >
            {loading ? 'Mengirim...' : 'Request Reschedule'}
          </button>
        </>
      )}
    </div>
  );
}
