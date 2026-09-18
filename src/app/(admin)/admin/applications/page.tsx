import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { approveApplicationAction, rejectApplicationAction, confirmPaymentAction, activateMembershipAction } from './actions';
import { approveBookingAction, rejectBookingAction, approveRescheduleAction, rejectRescheduleAction } from '../bookings/actions';
import { ChevronLeft } from 'lucide-react';

export default async function AdminReviewRequestsPage() {
  await requireActor(['ADMIN']);
  const db = await createServerClient();

  // Fetch pending applications
  const { data: applications } = await db
    .from('membership_applications')
    .select('*, members(full_name, phone), membership_plans(name)')
    .in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED'])
    .order('created_at', { ascending: true });

  // Fetch pending bookings & reschedules
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
    .in('status', ['PENDING', 'RESCHEDULE_REQUESTED'])
    .order('created_at', { ascending: true });

  const pendingApps = applications || [];
  const pendingBookings = bookings?.filter(b => b.status === 'PENDING') || [];
  const rescheduleRequests = bookings?.filter(b => b.status === 'RESCHEDULE_REQUESTED') || [];

  const totalRequests = pendingApps.length + pendingBookings.length + rescheduleRequests.length;

  return (
    <div>
      <div className="top" style={{ marginBottom: '24px' }}>
        <Link href="/admin" className="icon" style={{ textDecoration: 'none' }}>
          <ChevronLeft size={20} strokeWidth={2} />
        </Link>
        <div className="topmain">
          <h2>Review Requests</h2>
          <span>{totalRequests} pending requests</span>
        </div>
      </div>

      {/* ── Bookings ── */}
      {pendingBookings.map((b: any) => {
        const participantName = b.booking_participants[0]?.participant_type === 'MEMBER' 
          ? b.booking_participants[0]?.members?.full_name 
          : b.booking_participants[0]?.casual_customers?.full_name;
        
        const dateStr = new Date(b.session_slots.slot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const timeStr = b.session_slots.start_time.slice(0, 5);

        return (
          <div key={b.id} className="card" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '16px', padding: '16px' }}>
            <span className="pill wait" style={{ marginBottom: '8px' }}>PENDING</span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '4px' }}>{participantName}</div>
            <div className="sub">{dateStr} · {timeStr} · {b.is_casual ? 'Casual' : 'Member'}</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', width: '100%' }}>
              <form action={approveBookingAction.bind(null, b.id) as any} style={{ flex: 1 }}>
                <button type="submit" className="primary" style={{ width: '100%', margin: 0, padding: '12px' }}>Approve</button>
              </form>
              <form action={rejectBookingAction.bind(null, b.id) as any} style={{ flex: 1 }}>
                <button type="submit" className="primary" style={{ width: '100%', margin: 0, padding: '12px', background: '#efeee9', color: '#222' }}>Reject</button>
              </form>
            </div>
          </div>
        );
      })}

      {/* ── Reschedules ── */}
      <div className="section" style={{ marginTop: '24px' }}>
        <b>Reschedule</b>
        <span className="sub">{rescheduleRequests.length} request{rescheduleRequests.length !== 1 ? 's' : ''}</span>
      </div>
      {rescheduleRequests.map((b: any) => {
        const participantName = b.booking_participants[0]?.participant_type === 'MEMBER' 
          ? b.booking_participants[0]?.members?.full_name 
          : b.booking_participants[0]?.casual_customers?.full_name;
        
        const dateStr = new Date(b.session_slots.slot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const timeStr = b.session_slots.start_time.slice(0, 5);

        return (
          <div key={b.id} className="card" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '16px', padding: '16px' }}>
            <b style={{ fontSize: '14px' }}>{participantName}</b>
            <div className="sub" style={{ marginTop: '4px' }}>{dateStr} · {timeStr} (Requested Change)</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', width: '100%' }}>
              <form action={approveRescheduleAction.bind(null, b.id) as any} style={{ flex: 1 }}>
                <button type="submit" className="primary" style={{ width: '100%', margin: 0, padding: '12px', background: '#efeee9', color: '#222' }}>Review change</button>
              </form>
            </div>
          </div>
        );
      })}

      {/* ── Memberships ── */}
      <div className="section" style={{ marginTop: '24px' }}>
        <b>Membership</b>
        <span className="sub">{pendingApps.length} request{pendingApps.length !== 1 ? 's' : ''}</span>
      </div>
      {pendingApps.map((app: any) => (
        <div key={app.id} className="card" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '16px', padding: '16px' }}>
          <b style={{ fontSize: '14px' }}>{app.members?.full_name}</b>
          <div className="sub" style={{ marginTop: '4px' }}>
            {app.application_type} → {app.membership_plans?.name} ({app.status.replace('_', ' ')})
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', width: '100%' }}>
            {app.status === 'PENDING_REVIEW' && (
              <>
                <form action={approveApplicationAction.bind(null, app.id)} style={{ flex: 1 }}>
                  <button type="submit" className="primary" style={{ width: '100%', margin: 0, padding: '12px' }}>Approve</button>
                </form>
                <form action={rejectApplicationAction.bind(null, app.id)} style={{ flex: 1 }}>
                  <button type="submit" className="primary" style={{ width: '100%', margin: 0, padding: '12px', background: '#efeee9', color: '#222' }}>Reject</button>
                </form>
              </>
            )}
            {app.status === 'APPROVED' && (
              <form action={confirmPaymentAction.bind(null, app.id)} style={{ flex: 1 }}>
                <button type="submit" className="primary" style={{ width: '100%', margin: 0, padding: '12px', background: 'var(--gold)', color: '#171717' }}>Confirm Payment</button>
              </form>
            )}
            {app.status === 'PAYMENT_CONFIRMED' && (
              <form action={activateMembershipAction.bind(null, app.id)} style={{ flex: 1 }}>
                <button type="submit" className="primary" style={{ width: '100%', margin: 0, padding: '12px' }}>Activate</button>
              </form>
            )}
          </div>
        </div>
      ))}

      {totalRequests === 0 && (
        <div className="card" style={{ justifyContent: 'center', padding: '32px' }}>
          <span className="sub">No pending requests at the moment.</span>
        </div>
      )}
    </div>
  );
}
