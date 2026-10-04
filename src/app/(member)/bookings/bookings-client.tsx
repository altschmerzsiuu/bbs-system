'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, X, Star, Bell } from 'lucide-react';
import { BookingCard } from './booking-card';
import { TearableTicket } from '@/components/ui/tearable-ticket';

function isBookingPast(booking: any): boolean {
  const slot = booking.session_slots;
  if (!slot) return false;
  // Build a datetime from slot_date + end_time (local)
  const [h, m, s] = (slot.end_time as string).split(':').map(Number);
  const d = new Date(`${slot.slot_date}T00:00:00`);
  d.setHours(h, m, s ?? 0, 0);
  return d < new Date();
}

export function BookingsClient({ list, currentUserId }: { list: any[], currentUserId: string }) {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Completed' | 'Cancelled'>('Upcoming');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const UPCOMING_STATUSES = new Set(['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED']);

  // Filter out past sessions from upcoming (even if status hasn't changed yet)
  const upcoming = list.filter(b => UPCOMING_STATUSES.has(b.status) && !isBookingPast(b));
  const completed = list.filter(b => b.status === 'COMPLETED' || (UPCOMING_STATUSES.has(b.status) && isBookingPast(b)));
  const cancelled = list.filter(b => b.status === 'MEMBER_CANCELLED' || b.status === 'BBS_CANCELLED' || b.status === 'EXPIRED');

  let displayedList = upcoming;
  if (activeTab === 'Completed') displayedList = completed;
  if (activeTab === 'Cancelled') displayedList = cancelled;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedBooking) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedBooking]);

  const isUpcomingBooking = selectedBooking && UPCOMING_STATUSES.has(selectedBooking.status);

  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '16px 24px 0' }}>
        <button onClick={() => window.history.back()} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f5f7f5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <Link href="/notifications" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative', color: 'var(--ink)', border: '1px solid #efeade' }}>
          <Bell size={20} strokeWidth={1.75} />
          <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', background: 'var(--red)', borderRadius: '50%', border: '2px solid var(--white)' }}></div>
        </Link>
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
            {(['Upcoming', 'Completed', 'Cancelled'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === tab ? '#ebd2a4' : '#f5f7f5',
                  color: activeTab === tab ? '#5a4214' : 'var(--ink)',
                  transition: 'all 0.18s ease'
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

      {/* ── Ticket / Report Modal ── */}
      {selectedBooking && (
        <div
          onClick={() => setSelectedBooking(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isUpcomingBooking ? '20px' : '0',
            overscrollBehavior: 'contain',
          }}
        >
          {isUpcomingBooking ? (
            /* ── Ticket view (centered) ── */
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <button
                onClick={() => setSelectedBooking(null)}
                style={{ alignSelf: 'flex-end', background: 'rgba(255,255,255,0.15)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', backdropFilter: 'blur(4px)' }}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
              <TearableTicket
                topContent={
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '22px', fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>BBS</h3>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>Borneo Berkuda Stable</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '7px' }}>
                        <span style={{ background: 'var(--green)', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '5px 11px', borderRadius: '12px', letterSpacing: '0.4px' }}>{selectedBooking.status}</span>
                        <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase' }}>PASS #{selectedBooking.id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '3px' }}>
                        {new Date(`${selectedBooking.session_slots.slot_date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long' })}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid #e2dcd0', paddingBottom: '4px', display: 'inline-block', marginBottom: '20px' }}>
                        {selectedBooking.session_slots.slot_date}
                      </div>
                      <div style={{ font: '44px/1 var(--font-display)', marginBottom: '22px' }}>
                        {selectedBooking.session_slots.start_time.slice(0, 5)} — {selectedBooking.session_slots.end_time.slice(0, 5)}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
                        <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Membership</span><span style={{ fontSize: '13px', fontWeight: 700 }}>—</span></div>
                        <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Arena</span><span style={{ fontSize: '13px', fontWeight: 700 }}>Arena 01</span></div>
                      </div>
                    </div>
                  </div>
                }
                bottomContent={
                  <div style={{ padding: '18px 22px 22px' }}>
                    <div style={{ height: '40px', background: 'repeating-linear-gradient(90deg, #181817, #181817 2px, transparent 2px, transparent 4px)', marginBottom: '8px', opacity: 0.8 }}></div>
                    <div style={{ fontSize: '7.5px', fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', textAlign: 'center', color: '#181817' }}>Good Horses Brighter People</div>
                  </div>
                }
                stubContent={<span>BBS · GOOD HORSES BRIGHTER PEOPLE</span>}
              />
            </div>
          ) : (
            /* ── Completed/Session Report (bottom sheet) ── */
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: '#fff',
                borderRadius: '32px 32px 0 0',
                padding: '32px 24px 40px',
                maxHeight: '80vh',
                overflowY: 'auto',
              }}
            >
              <button
                onClick={() => setSelectedBooking(null)}
                style={{ position: 'absolute', top: '24px', right: '24px', background: '#f5f5f5', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
              <div style={{ width: '100%' }}>
                <h2 style={{ font: '28px var(--font-display)', margin: '0 0 8px 0', color: 'var(--ink)' }}>Session Report</h2>
                <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 24px' }}>Feedback from your trainer/groomer.</p>
                <div style={{ background: '#f9f6ef', borderRadius: '16px', padding: '20px', border: '1px solid #efeade' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Trainer Note</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--ink)' }}>No feedback recorded for this session yet.</p>
                </div>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '24px' }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={28} fill="var(--gold)" color="var(--gold)" />
                  ))}
                </div>
                <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>Rating for this session</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
