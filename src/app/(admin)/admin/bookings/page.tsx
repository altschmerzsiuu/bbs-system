import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { approveBookingAction, rejectBookingAction, approveRescheduleAction, rejectRescheduleAction, cancelBookingAction } from './actions';

function formatDate(iso: string, timeOnly = false) {
  const d = new Date(iso);
  if (timeOnly) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function AdminBookingsPage() {
  await requireActor(['ADMIN']);
  const db = await createServerClient();

  const { data: bookings } = await db
    .from('bookings')
    .select(`
      *,
      session_slots!bookings_slot_id_fkey(*),
      booking_participants(
        *,
        members(full_name, phone),
        casual_customers(full_name, phone),
        memberships(status, membership_plans(name))
      )
    `)
    .in('status', ['PENDING', 'RESCHEDULE_REQUESTED', 'CONFIRMED'])
    .order('created_at', { ascending: true });

  const pendingBookings = bookings?.filter(b => b.status === 'PENDING') || [];
  const rescheduleRequests = bookings?.filter(b => b.status === 'RESCHEDULE_REQUESTED') || [];
  const confirmedBookings = bookings?.filter(b => b.status === 'CONFIRMED') || [];

  return (
    <div>
      <div className="top" style={{ marginBottom: '24px' }}>
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Bookings Queue</b>
          <span>Admin Operations</span>
        </div>
        <Link href="/admin" className="bell">
          <i></i>🏠
        </Link>
      </div>

      <div className="sec">
        <h3>Pending Approvals</h3>
      </div>
      {pendingBookings.length === 0 ? (
        <div className="card" style={{ marginBottom: '24px' }}>
          <span style={{ color: 'var(--ink-2)' }}>No pending bookings.</span>
        </div>
      ) : (
        pendingBookings.map((b: any) => (
          <div key={b.id} className="card" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="chip-state" style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', color: '#FF9800' }}>PENDING</span>
              <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>Submitted {formatDate(b.created_at)}</span>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
              <b style={{ fontSize: '16px' }}>Slot: {formatDate(b.session_slots.slot_date + 'T' + b.session_slots.start_time)}</b>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <b style={{ fontSize: '14px', color: 'var(--ink-2)', marginBottom: '8px', display: 'block' }}>Participants ({b.booking_participants.length})</b>
              {b.booking_participants.map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <b style={{ fontSize: '14px', display: 'block' }}>
                      {p.participant_type === 'MEMBER' ? p.members?.full_name : p.casual_customers?.full_name}
                    </b>
                    <span style={{ fontSize: '12px', color: 'var(--ink-2)' }}>
                      {p.participant_type === 'MEMBER' ? `MEMBER · ${p.memberships?.membership_plans?.name || 'No Plan'}` : 'CASUAL'}
                    </span>
                  </div>
                  {p.participant_type === 'MEMBER' && p.memberships?.status !== 'ACTIVE' && (
                    <span style={{ fontSize: '12px', color: 'red' }}>Inactive Membership!</span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <form action={approveBookingAction.bind(null, b.id) as any} style={{ flex: 1 }}>
                <button type="submit" className="btn gold" style={{ width: '100%' }}>Approve</button>
              </form>
              <form action={rejectBookingAction.bind(null, b.id) as any} style={{ flex: 1 }}>
                <button type="submit" className="btn" style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--ink-3)', color: 'var(--ink-1)' }}>Reject</button>
              </form>
            </div>
          </div>
        ))
      )}

      <div className="sec">
        <h3>Reschedule Requests</h3>
      </div>
      {rescheduleRequests.length === 0 ? (
        <div className="card" style={{ marginBottom: '24px' }}>
          <span style={{ color: 'var(--ink-2)' }}>No reschedule requests.</span>
        </div>
      ) : (
        rescheduleRequests.map((b: any) => (
          <div key={b.id} className="card" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="chip-state" style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#2196F3' }}>RESCHEDULE REQUESTED</span>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--ink-2)', display: 'block' }}>Old Slot:</span>
              <b style={{ fontSize: '14px', textDecoration: 'line-through' }}>{formatDate(b.session_slots.slot_date + 'T' + b.session_slots.start_time)}</b>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <form action={approveRescheduleAction.bind(null, b.id) as any} style={{ flex: 1 }}>
                <button type="submit" className="btn gold" style={{ width: '100%' }}>Approve Reschedule</button>
              </form>
              <form action={rejectRescheduleAction.bind(null, b.id) as any} style={{ flex: 1 }}>
                <button type="submit" className="btn" style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--ink-3)', color: 'var(--ink-1)' }}>Keep Old Slot</button>
              </form>
            </div>
          </div>
        ))
      )}

      <div className="sec">
        <h3>Recently Confirmed</h3>
      </div>
      {confirmedBookings.length === 0 ? (
        <div className="card">
          <span style={{ color: 'var(--ink-2)' }}>No confirmed bookings.</span>
        </div>
      ) : (
        confirmedBookings.map((b: any) => (
          <div key={b.id} className="card" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: '16px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px' }}>{formatDate(b.session_slots.slot_date + 'T' + b.session_slots.start_time)}</span>
              <span className="chip-state" style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50' }}>CONFIRMED</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <form action={cancelBookingAction.bind(null, b.id) as any}>
                <button type="submit" className="btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--clay)', color: 'var(--clay)', padding: '4px 12px', fontSize: '12px' }}>Cancel (Admin)</button>
              </form>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
