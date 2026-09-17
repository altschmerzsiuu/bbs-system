import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';

export default async function AdminDashboardPage() {
  await requireActor(['ADMIN']);
  const db = await createServerClient();

  const [appsRes, bookingsRes, scheduleRes] = await Promise.all([
    db.from('membership_applications').select('id, status').in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED']),
    db.from('bookings').select('id, status').in('status', ['PENDING', 'RESCHEDULE_REQUESTED']),
    db.from('session_slots').select('id').eq('slot_date', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()))
  ]);

  const pendingAppsCount = appsRes.data?.length || 0;
  const pendingBookingsCount = bookingsRes.data?.filter(b => b.status === 'PENDING').length || 0;
  const rescheduleRequestsCount = bookingsRes.data?.filter(b => b.status === 'RESCHEDULE_REQUESTED').length || 0;
  const todaySlotsCount = scheduleRes.data?.length || 0;

  return (
    <div>
      <div className="top" style={{ marginBottom: '24px' }}>
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Good morning, Admin 👋</b>
          <span>Operational Dashboard</span>
        </div>
      </div>

      <div className="sec">
        <h3>Needs Attention</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>Applications</span>
          <b style={{ fontSize: '32px', color: 'var(--ink)' }}>{pendingAppsCount}</b>
          <Link href="/admin/applications" className="btn" style={{ width: '100%', marginTop: '12px' }}>Review →</Link>
        </div>
        
        <div className="card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>Bookings</span>
          <b style={{ fontSize: '32px', color: 'var(--ink)' }}>{pendingBookingsCount}</b>
          <Link href="/admin/bookings" className="btn" style={{ width: '100%', marginTop: '12px' }}>Review →</Link>
        </div>

        <div className="card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>Reschedules</span>
          <b style={{ fontSize: '32px', color: 'var(--ink)' }}>{rescheduleRequestsCount}</b>
          <Link href="/admin/bookings" className="btn" style={{ width: '100%', marginTop: '12px' }}>Review →</Link>
        </div>
      </div>

      <div className="sec">
        <h3>Today's Overview</h3>
      </div>

      <div className="card" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
          <div>
            <b style={{ fontSize: '16px', display: 'block' }}>Sessions Today</b>
            <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>{todaySlotsCount} active slots scheduled for today</span>
          </div>
        </div>
        <Link href="/admin/schedule" className="btn gold" style={{ width: '100%' }}>Manage Today's Schedule →</Link>
      </div>

      <div className="sec">
        <h3>Quick Links</h3>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Link href="/admin/applications" className="btn" style={{ backgroundColor: 'white', color: 'var(--ink)', border: '1px solid var(--line)' }}>All Applications</Link>
        <Link href="/admin/bookings" className="btn" style={{ backgroundColor: 'white', color: 'var(--ink)', border: '1px solid var(--line)' }}>All Bookings</Link>
        <Link href="/admin/schedule" className="btn" style={{ backgroundColor: 'white', color: 'var(--ink)', border: '1px solid var(--line)' }}>Schedule View</Link>
      </div>
    </div>
  );
}
