import React from 'react';
import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { Bell } from 'lucide-react';

export default async function AdminDashboardPage() {
  await requireActor(['ADMIN']);

  return (
    <div>
      <div className="top">
        <div className="avatar initial">AD</div>
        <div className="topmain">
          <b>Good morning, Admin.</b>
          <span>Saturday · 20 September 2026</span>
        </div>
        <button className="icon" aria-label="Notifications">
          <Bell size={20} strokeWidth={2} />
        </button>
      </div>

      <div className="adminHero">
        <span className="eyebrow" style={{ color: '#d8c18a' }}>NEEDS ATTENTION</span>
        <div className="big">4 pending requests</div>
        <div style={{ fontSize: '8px', color: '#aaa', lineHeight: 1.5 }}>
          2 bookings · 1 reschedule · 1 membership
        </div>
        <Link href="/admin/applications" className="primary" style={{ marginTop: '13px', background: '#b9974f', color: '#171717' }}>
          Review now →
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

      <div className="section">
        <b>Today's flow</b>
        <Link href="/admin/schedule">
          View schedule
        </Link>
      </div>

      <div className="list">
        <Link href="/admin/schedule" className="row">
          <div className="date">07:00</div>
          <div className="rowmain">
            <b>2 riders</b>
            <span>Keisha · Sarah · Arena 01</span>
          </div>
          <span className="pill ok">Ready</span>
        </Link>

        <Link href="/admin/schedule" className="row">
          <div className="date">16:00</div>
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
