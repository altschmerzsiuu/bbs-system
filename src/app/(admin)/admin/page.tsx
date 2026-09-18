import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { Users, Calendar, Ticket, ChevronRight } from 'lucide-react';

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
      {/* ── Top ── */}
      <div className="top" style={{ marginBottom: '20px' }}>
        <div className="topmain">
          <h2>Good morning,<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Admin.</em></h2>
          <span className="sub">Operational Dashboard</span>
        </div>
      </div>

      <div className="section">
        <b>Needs Attention</b>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <Link href="/admin/applications" className="card" style={{ flexDirection: 'column', alignItems: 'flex-start', textDecoration: 'none', padding: '16px' }}>
          <span className="eyebrow">APPLICATIONS</span>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--ink)', margin: '4px 0' }}>{pendingAppsCount}</b>
          <div className="sub" style={{ display: 'flex', alignItems: 'center', color: 'var(--gold)', fontWeight: 600 }}>
            Review <ChevronRight size={14} style={{ marginLeft: '2px' }} />
          </div>
        </Link>
        
        <Link href="/admin/bookings" className="card" style={{ flexDirection: 'column', alignItems: 'flex-start', textDecoration: 'none', padding: '16px' }}>
          <span className="eyebrow">BOOKINGS</span>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--ink)', margin: '4px 0' }}>{pendingBookingsCount}</b>
          <div className="sub" style={{ display: 'flex', alignItems: 'center', color: 'var(--gold)', fontWeight: 600 }}>
            Review <ChevronRight size={14} style={{ marginLeft: '2px' }} />
          </div>
        </Link>

        <Link href="/admin/bookings" className="card" style={{ flexDirection: 'column', alignItems: 'flex-start', textDecoration: 'none', padding: '16px', gridColumn: 'span 2' }}>
          <span className="eyebrow">RESCHEDULES</span>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--ink)', margin: '4px 0' }}>{rescheduleRequestsCount}</b>
          <div className="sub" style={{ display: 'flex', alignItems: 'center', color: 'var(--gold)', fontWeight: 600 }}>
            Review <ChevronRight size={14} style={{ marginLeft: '2px' }} />
          </div>
        </Link>
      </div>

      <div className="section">
        <b>Today's Overview</b>
      </div>
      <div className="card" style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '24px', padding: '16px' }}>
        <b style={{ fontSize: '15px' }}>Sessions Today</b>
        <span className="sub" style={{ marginTop: '2px', marginBottom: '16px' }}>{todaySlotsCount} active slots scheduled for today</span>
        <Link href="/admin/schedule" style={{ width: '100%', textDecoration: 'none' }}>
          <button className="primary" style={{ margin: 0 }}>Manage Schedule →</button>
        </Link>
      </div>

      <div className="section">
        <b>Quick Links</b>
      </div>
      <div className="settings">
        <Link href="/admin/applications" className="setting" style={{ textDecoration: 'none' }}>
          <Users size={16} strokeWidth={1.75} color="var(--muted)" />
          <span style={{ color: 'var(--ink)' }}>All Applications</span>
          <ChevronRight size={14} strokeWidth={1.75} color="var(--muted)" />
        </Link>
        <Link href="/admin/bookings" className="setting" style={{ textDecoration: 'none' }}>
          <Ticket size={16} strokeWidth={1.75} color="var(--muted)" />
          <span style={{ color: 'var(--ink)' }}>All Bookings</span>
          <ChevronRight size={14} strokeWidth={1.75} color="var(--muted)" />
        </Link>
        <Link href="/admin/schedule" className="setting" style={{ textDecoration: 'none' }}>
          <Calendar size={16} strokeWidth={1.75} color="var(--muted)" />
          <span style={{ color: 'var(--ink)' }}>Schedule View</span>
          <ChevronRight size={14} strokeWidth={1.75} color="var(--muted)" />
        </Link>
      </div>
    </div>
  );
}
