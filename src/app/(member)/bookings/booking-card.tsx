'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cancelBookingAction } from './actions';

interface BookingCardProps {
  booking: any;
  isOwner: boolean;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return { day: d.getDate(), mon: MONTHS[d.getMonth()].toUpperCase() };
}

function pillClass(status: string): string {
  if (status === 'CONFIRMED') return 'ok';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'no';
  if (['PENDING', 'RESCHEDULE_REQUESTED'].includes(status)) return 'wait';
  return 'done';
}

export function BookingCard({ booking, isOwner }: BookingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [expanded, setExpanded] = useState(false);

  const dt         = formatDate(booking.session_slots.slot_date);
  const isUpcoming = ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(booking.status);

  const handleCancel = async () => {
    const startsAt  = new Date(`${booking.session_slots.slot_date}T${booking.session_slots.start_time}+08:00`);
    const diffHours = (startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
    const msg       = diffHours < 6
      ? 'Cancellation within 6 hours will forfeit your credit. Continue?'
      : 'Cancel this booking?';
    if (!confirm(msg)) return;
    setLoading(true);
    setError('');
    const res = await cancelBookingAction(booking.id, diffHours < 6);
    setLoading(false);
    if (!res.ok) setError(res.message);
  };

  return (
    <div>
      <div
        className="row"
        onClick={() => isUpcoming && setExpanded(e => !e)}
        style={{ cursor: isUpcoming ? 'pointer' : 'default' }}
      >
        <div className="date">
          <b>{dt.day}</b>
          <span>{dt.mon}</span>
        </div>
        <div className="rowmain">
          <b>{booking.session_slots.start_time.slice(0, 5)} — {booking.session_slots.end_time.slice(0, 5)}</b>
          <span>Arena 01</span>
        </div>
        <span className={`pill ${pillClass(booking.status)}`}>
          {booking.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Expanded actions */}
      {expanded && isUpcoming && isOwner && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', marginBottom: '4px', paddingInline: '4px' }}>
          <button
            className="btn"
            style={{ flex: 1, background: '#f7e3e1', color: 'var(--red)', marginTop: 0 }}
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? '...' : 'Cancel Session'}
          </button>
          <Link href={`/bookings/${booking.id}/reschedule`} style={{ flex: 1, textDecoration: 'none' }}>
            <button
              className="btn"
              style={{ width: '100%', background: '#efeee9', color: 'var(--ink)', marginTop: 0 }}
              disabled={loading || booking.status === 'RESCHEDULE_REQUESTED'}
            >
              Reschedule
            </button>
          </Link>
        </div>
      )}

      {error && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '4px', paddingInline: '4px' }}>{error}</div>}
    </div>
  );
}
