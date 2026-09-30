'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, ArrowRight, Calendar, Ticket, CreditCard, ChevronLeft, MoreHorizontal, MapPin, User as UserIcon, Award, HelpCircle, X } from 'lucide-react';
import Image from 'next/image';
import { TearableTicket } from '@/components/ui/tearable-ticket';
import { useRouter } from 'next/navigation';
import { cancelBookingAction } from '../bookings/actions';

const DAYS_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return {
    day: d.getDate(),
    mon: MONTHS_SHORT[d.getMonth()].toUpperCase(),
    label: `${DAYS_FULL[d.getDay()]} · ${d.getDate()} ${MONTHS_FULL[d.getMonth()].toUpperCase()} ${d.getFullYear()}`,
    shortLabel: `${DAYS_FULL[d.getDay()].substring(0, 3)}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
  };
}

export function HomeClient({ data, avatarUrl }: { data: any, avatarUrl?: string }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const firstName = data.memberName.split(' ')[0];
  const tier = data.membership?.plan ?? 'Basic';
  const isGold = tier.toUpperCase().includes('GOLD');
  const isSilver = tier.toUpperCase().includes('SILVER');

  const nextBooking = data.nextBooking;

  const cardGradient = isGold
    ? 'linear-gradient(135deg, #eaddbd 0%, #d0b070 100%)'
    : isSilver
      ? 'linear-gradient(135deg, #f0f0f0 0%, #d4d4d4 100%)'
      : 'linear-gradient(135deg, #efeee9 0%, #e0dfda 100%)';

  const [greeting, setGreeting] = useState('Welcome');

  React.useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  return (
    <div suppressHydrationWarning style={{ position: 'relative', minHeight: '100vh', background: 'var(--paper)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 12px' }}>
        <Link href="/profile">
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--white)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0dfda' }}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile" width={48} height={48} style={{ width: '100%', height: '100%', objectFit: 'cover' }} priority />
            ) : (
              <UserIcon size={24} color="#a09d94" />
            )}
          </div>
        </Link>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/notifications" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative', color: 'var(--ink)' }}>
            <Bell size={20} strokeWidth={1.75} />
            {data.unreadNotifications > 0 && (
              <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', background: 'var(--red)', borderRadius: '50%', border: '2px solid var(--white)' }}></div>
            )}
          </Link>
        </div>
      </div>

      {/* ── Greeting ── */}
      <div style={{ padding: '12px 24px 24px' }}>
        <h1 style={{ margin: '0 0 12px 0', color: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '28px', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--ink)', marginBottom: '4px' }}>{greeting},</span>
          <span style={{ fontSize: '48px', lineHeight: 1.05, fontFamily: 'var(--font-display)' }}>{firstName}.</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
          {tier !== 'Basic' && (
            <>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: isGold ? 'linear-gradient(135deg, #f3e9d2, #d1a85b)' : isSilver ? 'linear-gradient(135deg, #e0e0e0, #9e9e9e)' : '#fcfbfa',
                color: isGold ? '#5a4214' : isSilver ? '#fff' : 'var(--ink)',
                padding: '6px 12px',
                borderRadius: '100px',
                fontWeight: 800,
                fontSize: '11px',
                letterSpacing: '1px',
              }}>
                {(isGold || isSilver) && <Award size={14} strokeWidth={2.5} />}
                {tier.toUpperCase()} MEMBER
              </div>
              <span>•</span>
              <span>{data.membership?.available ?? 0} sessions left</span>
            </>
          )}
        </div>
      </div>

      {/* ── Next Ride Card ── */}
      <div style={{ padding: '0 24px' }}>
        {nextBooking ? (
          <div>
            <div
              style={{
                background: cardGradient,
                borderRadius: '24px',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
                color: 'var(--ink)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
              }}
            >
              {/* Overlay horse image (subtle) */}
              <div style={{ position: 'absolute', right: '-20%', bottom: 0, height: '120%', width: '70%', opacity: 0.15, mixBlendMode: 'multiply', pointerEvents: 'none' }}>
                <Image src="/images/horse-8.jpg" width={300} height={300} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'left' }} alt="" priority />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink)', opacity: 0.8, marginBottom: '8px' }}>
                      YOUR NEXT SESSION
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600, opacity: 0.9 }}>
                      {fmtDate(nextBooking.date).shortLabel}
                    </div>
                  </div>
                  <div style={{ background: '#7c9a75', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                    {nextBooking.status}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                  <div style={{ font: '52px/0.95 var(--font-display)', display: 'flex', flexDirection: 'column' }}>
                    <span>{nextBooking.startTime.slice(0, 5)} —</span>
                    <span>{nextBooking.endTime.slice(0, 5)}</span>
                  </div>

                  {/* Arrow Button */}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--white)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.15)', flexShrink: 0, marginBottom: '4px' }}
                  >
                    <ArrowRight size={24} strokeWidth={2} />
                  </button>
                </div>

                <div style={{ fontSize: '11px', color: '#5f5542', fontWeight: 600, fontStyle: 'italic' }}>
                  * Cancel/reschedule 24 hours before your session starts.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Link href={tier !== 'Basic' ? "/schedule" : "/request?type=ride"} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ background: cardGradient, borderRadius: '24px', padding: '36px 24px', textAlign: 'center', color: 'var(--ink)', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', opacity: 0.7, marginBottom: '16px', textTransform: 'uppercase' }}>No upcoming ride</div>
              <h3 style={{ font: '28px var(--font-display)', margin: '0 0 8px 0' }}>Book a session</h3>
              <p style={{ fontSize: '14px', opacity: 0.8, margin: 0 }}>Choose from available slots below</p>
            </div>
          </Link>
        )}
      </div>

      {/* ── Quick Grid (3 Items) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '24px' }}>
        <Link href={tier !== 'Basic' ? "/schedule" : "/request?type=ride"} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <Calendar size={28} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Book a Ride</span>
        </Link>
        <Link href="/bookings" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <Ticket size={28} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>My Rides</span>
        </Link>
        <Link href="/membership" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            <CreditCard size={28} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Membership</span>
        </Link>
      </div>

      {/* ── BBS Quote ── */}
      <div style={{ padding: '0 24px 40px' }}>
        <div style={{
          position: 'relative',
          borderRadius: '24px',
          overflow: 'hidden',
          background: 'var(--ink)',
          padding: '32px 24px',
          minHeight: '160px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <Image src="/images/horse-riding-showcase.jpg" fill style={{ objectFit: 'cover', opacity: 0.4 }} alt="Background" />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ font: '32px/1.1 var(--font-display)', margin: '0 0 16px 0', color: 'var(--white)' }}>
              "A better you<br />rides here."
            </h2>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)' }}>
              BORNEO BERKUDA STABLE
            </div>
          </div>
        </div>
      </div>

      {/* ── Riding Pass Modal ── */}
      {isModalOpen && nextBooking && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: 'var(--white)', overflowY: 'auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
            <button onClick={() => setIsModalOpen(false)} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--paper)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}>
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
            <button style={{ background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer' }}>
              <MoreHorizontal size={24} />
            </button>
          </div>

          <div style={{ padding: '0 24px 16px' }}>
            <h2 style={{ font: '36px var(--font-display)', margin: '0 0 4px 0', color: 'var(--ink)' }}>Riding Pass</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', margin: 0 }}>Here's your session detail</p>
          </div>

          <div style={{ padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: '32px' }}>
            <div style={{ width: '100%', maxWidth: '340px', margin: '0 auto' }}>
              <TearableTicket 
                topContent={
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '22px', fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>BBS</h3>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>Borneo Berkuda Stable</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '7px' }}>
                        <span style={{ background: 'var(--green)', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '5px 11px', borderRadius: '12px', letterSpacing: '0.4px' }}>{nextBooking.status}</span>
                        <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase' }}>PASS #{nextBooking.id.substring(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '3px' }}>
                        {DAYS_FULL[new Date(`${nextBooking.date}T00:00:00`).getDay()]}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid #e2dcd0', paddingBottom: '4px', display: 'inline-block', marginBottom: '20px' }}>
                        {new Date(`${nextBooking.date}T00:00:00`).getDate()} {MONTHS_FULL[new Date(`${nextBooking.date}T00:00:00`).getMonth()].toUpperCase()} {new Date(`${nextBooking.date}T00:00:00`).getFullYear()}
                      </div>
                      <div style={{ font: '44px/1 var(--font-display)', marginBottom: '22px' }}>
                        {nextBooking.startTime.slice(0, 5)} — {nextBooking.endTime.slice(0, 5)}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
                        <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Membership</span><span style={{ fontSize: '13px', fontWeight: 700 }}>{tier}</span></div>
                        <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Arena</span><span style={{ fontSize: '13px', fontWeight: 700 }}>Arena 01</span></div>
                        <div><span style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Rider</span><span style={{ fontSize: '13px', fontWeight: 700 }}>{firstName}</span></div>
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

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
              <button 
                className="primary" 
                style={{ width: '100%', height: '56px', fontSize: '15px' }}
                onClick={() => router.push(`/bookings/${nextBooking.id}/reschedule`)}
              >
                Reschedule
              </button>
              <button 
                className="primary" 
                style={{ width: '100%', height: '56px', fontSize: '15px', background: '#faeae9', color: '#c06c64' }}
                onClick={async () => {
                  if (confirm('Are you sure you want to cancel this session? This action cannot be undone.')) {
                    const res = await cancelBookingAction(nextBooking.id, true);
                    if (res.ok) {
                      alert('Session cancelled successfully.');
                      setIsModalOpen(false);
                      router.refresh();
                    } else {
                      alert(`Failed to cancel: ${res.message}`);
                    }
                  }
                }}
              >
                Cancel Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
