'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, MoreHorizontal, X, Share, Star, Bell } from 'lucide-react';
import { BookingCard } from './booking-card';
import { TearableTicket } from '@/components/ui/tearable-ticket';

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


      {/* ── Modals ── */}
      {selectedBooking && (
        <div
          onClick={() => setSelectedBooking(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)', padding: UPCOMING_STATUSES.has(selectedBooking.status) ? '40px 20px' : 0 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: UPCOMING_STATUSES.has(selectedBooking.status) ? 'transparent' : '#fff', 
              borderRadius: UPCOMING_STATUSES.has(selectedBooking.status) ? 0 : '32px 32px 0 0', 
              padding: UPCOMING_STATUSES.has(selectedBooking.status) ? 0 : '32px 24px 40px', 
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {UPCOMING_STATUSES.has(selectedBooking.status) ? (
              <>
                <button
                  onClick={() => setSelectedBooking(null)}
                  style={{ alignSelf: 'flex-start', marginBottom: '16px', background: '#fff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
                <div style={{ width: '100%', maxWidth: '340px' }}>
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
                          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '3px' }}>Minggu</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid #e2dcd0', paddingBottom: '4px', display: 'inline-block', marginBottom: '20px' }}>{selectedBooking.session_slots.slot_date}</div>
                          <div style={{ font: '44px/1 var(--font-display)', marginBottom: '22px' }}>{selectedBooking.session_slots.start_time.slice(0, 5)} — {selectedBooking.session_slots.end_time.slice(0, 5)}</div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
                            <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Membership</span><span style={{ fontSize: '13px', fontWeight: 700 }}>Gold</span></div>
                            <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Arena</span><span style={{ fontSize: '13px', fontWeight: 700 }}>Arena 01</span></div>
                            <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Rider</span><span style={{ fontSize: '13px', fontWeight: 700 }}>Keisha</span></div>
                            <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Groom on duty</span><span style={{ fontSize: '13px', fontWeight: 700 }}>Ridwan</span></div>
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
                    stubContent={
                      <span>BBS · GOOD HORSES BRIGHTER PEOPLE</span>
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedBooking(null)}
                  style={{ position: 'absolute', top: '24px', right: '24px', background: '#f5f5f5', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>

                <div style={{ width: '100%' }}>
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
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
