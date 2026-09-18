import React from 'react';
import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { ChevronLeft } from 'lucide-react';

export default async function AdminReviewRequestsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  await requireActor(['ADMIN']);
  const searchParams = await props.searchParams;
  const tab = searchParams.tab || 'bookings';

  return (
    <div>
      <div className="top">
        <Link href="/admin" className="icon" style={{ textDecoration: 'none' }}>
          <ChevronLeft size={20} strokeWidth={2} color="var(--ink)" />
        </Link>
        <div className="topmain">
          <h2>Review Requests</h2>
          <span>
            {tab === 'bookings' ? '2 booking' : tab === 'reschedule' ? '1 reschedule' : '1 membership'} requests
          </span>
        </div>
      </div>

      <div className="filters">
        <Link href="?tab=bookings" className={`filter ${tab === 'bookings' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Bookings</Link>
        <Link href="?tab=reschedule" className={`filter ${tab === 'reschedule' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Reschedule</Link>
        <Link href="?tab=membership" className={`filter ${tab === 'membership' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Membership</Link>
      </div>

      {tab === 'bookings' && (
        <>
          <div className="card" style={{ marginBottom: '16px' }}>
            <span className="pill wait">PENDING</span>
            <div style={{ font: '20px var(--font-display)', marginTop: '9px', marginBottom: '4px' }}>Keisha Alviani</div>
            <div className="sub">27 Sep · 15:00 — 15:45 · Gold</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '13px' }}>
              <button className="primary" style={{ flex: 1 }}>Approve</button>
              <button className="primary" style={{ flex: 1, background: '#efeee9', color: '#171717' }}>Reject</button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <span className="pill wait">PENDING</span>
            <div style={{ font: '20px var(--font-display)', marginTop: '9px', marginBottom: '4px' }}>Andi Pratama</div>
            <div className="sub">28 Sep · 07:00 — 07:45 · Casual</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '13px' }}>
              <button className="primary" style={{ flex: 1 }}>Approve</button>
              <button className="primary" style={{ flex: 1, background: '#efeee9', color: '#171717' }}>Reject</button>
            </div>
          </div>
        </>
      )}

      {tab === 'reschedule' && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <b style={{ fontSize: '14px' }}>Sarah</b>
          <div className="sub" style={{ marginTop: '4px' }}>20 Sep · 16:00 → 17:00</div>
          <button className="primary" style={{ marginTop: '13px', background: '#efeee9', color: '#171717' }}>Review change</button>
        </div>
      )}

      {tab === 'membership' && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <b style={{ fontSize: '14px' }}>Nadia Putri</b>
          <div className="sub" style={{ marginTop: '4px' }}>Upgrade Silver → Gold</div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '13px' }}>
            <button className="primary" style={{ flex: 1 }}>Approve</button>
            <button className="primary" style={{ flex: 1, background: '#efeee9', color: '#171717' }}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
