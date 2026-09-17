'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { cancelBookingAction } from './actions';

interface BookingCardProps {
  booking: any;
  isOwner: boolean;
}

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return {
    full: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    day:  d.getDate(),
    mon:  MONTHS[d.getMonth()],
  };
}

export function BookingCard({ booking, isOwner }: BookingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dt = formatDate(booking.session_slots.slot_date);
  
  const handleCancel = async () => {
    // Check if < 6 hours
    const startsAt = new Date(`${booking.session_slots.slot_date}T${booking.session_slots.start_time}+08:00`);
    const diffHours = (startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
    
    if (diffHours < 6) {
      if (!confirm('Pembatalan kurang dari 6 jam akan menghanguskan kredit Anda. Yakin ingin membatalkan?')) {
        return;
      }
    } else {
      if (!confirm('Yakin ingin membatalkan booking ini?')) {
        return;
      }
    }

    setLoading(true);
    setError('');
    const res = await cancelBookingAction(booking.id, diffHours < 6);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
    }
  };

  const isUpcoming = ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(booking.status);
  
  return (
    <div className="card" style={{ opacity: isUpcoming ? 1 : 0.8, flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="date">
            <b>{dt.day}</b>
            <span>{dt.mon}</span>
          </div>
          <div className="body">
            <b>{booking.session_slots.start_time.slice(0, 5)} — {booking.session_slots.end_time.slice(0, 5)}</b>
            <span>{isUpcoming ? 'Sesi berkuda' : dt.full}</span>
          </div>
        </div>
        <span className={`pill ${booking.status.toLowerCase() === 'confirmed' ? 'ok' : !isUpcoming ? 'done' : 'wait'}`}>
          {booking.status.replace('_', ' ')}
        </span>
      </div>

      {error && (
        <span style={{ color: 'var(--cherry)', fontSize: '12px', marginTop: '8px' }}>{error}</span>
      )}

      {isUpcoming && isOwner && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--cloud)' }}>
          <button 
            className="btn" 
            style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--cherry)', border: '1px solid var(--cherry)' }}
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? '...' : 'Cancel'}
          </button>
          
          <Link href={`/bookings/${booking.id}/reschedule`} style={{ flex: 1, textDecoration: 'none' }}>
            <button 
              className="btn gold" 
              style={{ width: '100%' }}
              disabled={loading || booking.status === 'RESCHEDULE_REQUESTED'}
            >
              Reschedule
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
