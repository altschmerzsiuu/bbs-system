import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { Bell } from 'lucide-react';

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
  const totalPending = pendingAppsCount + pendingBookingsCount + rescheduleRequestsCount;

  return (
    <div>
      <div className="top" style={{ marginBottom: '16px' }}>
        <div className="avatar initial">AD</div>
        <div className="topmain">
          <b>Good morning, Admin.</b>
          <span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <button className="icon" aria-label="Notifications">
          <Bell size={18} strokeWidth={2} color="var(--ink)" />
        </button>
      </div>

      <div className="adminHero">
        <span className="eyebrow" style={{ color: '#d8c18a' }}>NEEDS ATTENTION</span>
        <div className="big">{totalPending} pending requests</div>
        <div style={{ fontSize: '8px', color: '#aaa', lineHeight: 1.5 }}>
          {pendingBookingsCount} bookings · {rescheduleRequestsCount} reschedule · {pendingAppsCount} membership
        </div>
        <Link href="/admin/applications" style={{ textDecoration: 'none' }}>
          <button className="primary" style={{ marginTop: '13px', background: 'var(--gold)', color: '#171717' }}>
            Review now →
          </button>
        </Link>
      </div>

      <div className="statStrip">
        <div className="stat">
          <strong>12</strong>
          <span>Sessions</span>
        </div>
        <div className="stat">
          <strong>8</strong>
          <span>Members</span>
        </div>
        <div className="stat">
          <strong>2</strong>
          <span>Spots left</span>
        </div>
        <div className="stat">
          <strong>1</strong>
          <span>Issues</span>
        </div>
      </div>

      <div className="section" style={{ marginTop: '16px' }}>
        <b>Today's flow</b>
        <Link href="/admin/schedule" style={{ textDecoration: 'none', color: 'var(--gold)', fontSize: '11px', fontWeight: 600 }}>
          View schedule
        </Link>
      </div>

      <div className="list">
        <Link href="/admin/schedule" className="row" style={{ textDecoration: 'none' }}>
          <div className="date" style={{ background: 'transparent' }}>
            <b style={{ fontSize: '18px' }}>07:00</b>
          </div>
          <div className="rowmain">
            <b>2 riders</b>
            <span>Keisha · Sarah · Arena 01</span>
          </div>
          <span className="pill ok">Ready</span>
        </Link>
        <Link href="/admin/schedule" className="row" style={{ textDecoration: 'none' }}>
          <div className="date" style={{ background: 'transparent' }}>
            <b style={{ fontSize: '18px' }}>16:00</b>
          </div>
          <div className="rowmain">
            <b>2 riders</b>
            <span>Keisha · Sarah · Arena 01</span>
          </div>
          <span className="pill wait">Upcoming</span>
        </Link>
      </div>
    </div>
  );
}
