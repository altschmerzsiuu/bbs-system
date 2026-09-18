'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, MoreHorizontal, X, Share, Star, Bell } from 'lucide-react';
import { BookingCard } from './booking-card';

export function BookingsClient({ list, currentUserId }: { list: any[], currentUserId: string }) {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Completed' | 'Cancelled'>('Upcoming');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const UPCOMING_STATUSES = new Set(['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED']);

  const upcoming = list.filter(b => UPCOMING_STATUSES.has(b.status));
  const completed = list.filter(b => b.status === 'COMPLETED');
  const cancelled = list.filter(b => b.status === 'CANCELLED' || b.status === 'EXPIRED');

  let displayedList = upcoming;
  if (activeTab === 'Completed') displayedList = completed;
  if (activeTab === 'Cancelled') displayedList = cancelled;

  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '16px 24px 0' }}>
        <button onClick={() => window.history.back()} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f5f7f5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'transparent', border: '1px solid #efeade', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}>
            <Share size={20} />
          </button>
          <Link href="/notifications" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative', color: 'var(--ink)', border: '1px solid #efeade' }}>
            <Bell size={20} strokeWidth={1.75} />
            <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', background: 'var(--red)', borderRadius: '50%', border: '2px solid var(--white)' }}></div>
          </Link>
        </div>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <h1 style={{ font: '40px/1.1 var(--font-display)', margin: '0 0 4px 0', color: 'var(--ink)' }}>My Rides</h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>Your riding journey</p>
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '48px', padding: '0 24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '48px', color: 'var(--goldSoft)', marginBottom: '12px' }}>✦</div>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>No rides yet</div>
          <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>Book your first session at the stable.</div>
          <Link href="/schedule">
            <button className="primary" style={{ maxWidth: '220px', margin: '0 auto', background: 'var(--ink)' }}>Book a Ride</button>
          </Link>
        </div>
      ) : (
        <div style={{ padding: '0 24px 24px' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {['Upcoming', 'Completed', 'Cancelled'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                padding: '10px 16px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTab === tab ? '#ebd2a4' : '#f5f7f5',
                color: activeTab === tab ? '#5a4214' : 'var(--ink)',
                transition: 'all 0.2s'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {displayedList.length > 0 ? (
            displayedList.map((booking: any) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    isOwner={booking.created_by === currentUserId}
                    hasFeedback={!!booking.feedback}
                    onClick={() => setSelectedBooking(booking)}
                  />
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '14px' }}>
              No {activeTab.toLowerCase()} rides found.
            </div>
          )}
        </div>
        </div>
      )}


      {/* ── Report Modal ── */}
      {selectedBooking && (
        <div
          onClick={() => setSelectedBooking(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '32px 32px 0 0', padding: '32px 24px 40px', position: 'relative' }}
          >
            <button
              onClick={() => setSelectedBooking(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: '#f5f5f5', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            <h2 style={{ font: '28px var(--font-display)', margin: '0 0 8px 0', color: 'var(--ink)' }}>Session Report</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 24px' }}>
              Feedback from your trainer/groomer.
            </p>

            <div style={{ background: '#f9f6ef', borderRadius: '16px', padding: '20px', border: '1px solid #efeade' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Trainer Note</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gold)' }}>Sarah</span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--ink)' }}>
                "Great session today! You handled the trot perfectly and kept your heels down nicely. Next time we will focus more on cantering transitions. Keep up the good work!"
              </p>
            </div>

            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '24px' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={28} fill="var(--gold)" color="var(--gold)" />
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
              Rating for this session
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
