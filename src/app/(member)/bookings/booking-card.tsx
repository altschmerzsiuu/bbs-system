'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cancelBookingAction } from './actions';

interface BookingCardProps {
  booking: any;
  isOwner: boolean;
  hasFeedback?: boolean;
  onClick?: () => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return { day: d.getDate(), mon: MONTHS[d.getMonth()].toUpperCase() };
}

function pillStyles(status: string): React.CSSProperties {
  if (status === 'CONFIRMED') return { background: '#dce8dd', color: '#4c6c51' };
  if (status === 'CANCELLED' || status === 'EXPIRED') return { background: '#f5f7f5', color: '#777a77' };
  if (['PENDING', 'RESCHEDULE_REQUESTED'].includes(status)) return { background: '#eedcb8', color: '#5a4214' };
  return { background: '#dce8dd', color: '#4c6c51' }; // Completed
}

export function BookingCard({ booking, isOwner, hasFeedback, onClick }: BookingCardProps) {
  const dt = formatDate(booking.session_slots.slot_date);

  const isUpcoming = ['PENDING', 'CONFIRMED'].includes(booking.status);
  const clickable = Boolean((hasFeedback || isUpcoming) && onClick);

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        background: '#fff',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        cursor: clickable ? 'pointer' : 'default',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}
    >
      {/* Date Box */}
      <div style={{ background: '#f5f7f5', borderRadius: '12px', width: '56px', height: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ font: '24px/1 var(--font-display)', color: 'var(--ink)' }}>{dt.day}</span>
        <span style={{ fontSize: '11px', color: 'var(--ink)', fontWeight: 600, marginTop: '2px' }}>{dt.mon.charAt(0) + dt.mon.slice(1).toLowerCase()}</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ font: '18px var(--font-display)', color: 'var(--ink)' }}>
            {booking.session_slots.start_time.slice(0, 5)} — {booking.session_slots.end_time.slice(0, 5)}
          </span>
          {clickable && <ChevronRight size={16} color="var(--ink)" />}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
          Borneo Berkuda Stable
        </div>
        <div style={{ 
          display: 'inline-block', 
          padding: '4px 12px', 
          borderRadius: '12px', 
          fontSize: '11px', 
          fontWeight: 700,
          ...pillStyles(booking.status)
        }}>
          {booking.status.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );
}
