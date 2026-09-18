import Link from 'next/link';
import { Bell, ArrowRight, Calendar, Ticket, CreditCard, User } from 'lucide-react';
import { getMemberHome } from '@/modules/bookings/booking-queries';
import { requireActor } from '@/lib/auth';
import { FCMRegistrar } from '@/modules/notifications/components/fcm-registrar';

const DAYS_FULL   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return {
    day: d.getDate(),
    mon: MONTHS_SHORT[d.getMonth()].toUpperCase(),
    label: `${DAYS_FULL[d.getDay()].toUpperCase()} · ${d.getDate()} ${MONTHS_FULL[d.getMonth()].toUpperCase()} ${d.getFullYear()}`,
  };
}

function statusClass(status: string) {
  if (status === 'CONFIRMED') return 'ok';
  if (status === 'PENDING')   return 'wait';
  return 'done';
}

export default async function MemberHomePage() {
  const actor = await requireActor(['MEMBER']);
  const data  = await getMemberHome(actor.memberId!);
  const firstName = data.memberName.split(' ')[0];
  const tier = data.membership?.plan ?? null;

  return (
    <div>
      <FCMRegistrar />

      {/* ── Top Bar ── */}
      <div className="top">
        <div className="avatar" style={{ background: '#ded8c8' }}>
          {firstName.charAt(0).toUpperCase()}
        </div>
        <div className="topmain">
          <b>Hello, {firstName}.</b>
          <span>{tier ? `${tier} Member · ${data.membership?.available ?? 0} sessions left` : 'Member BBS'}</span>
        </div>
        <Link href="/notifications" className="icon" aria-label="Notifications">
          <Bell size={18} strokeWidth={1.8} />
        </Link>
      </div>

      {/* ── Next Ride ── */}
      <div className="section" style={{ marginTop: 0 }}>
        <span className="eyebrow">YOUR NEXT RIDE</span>
        {data.nextBooking && (
          <span className={`pill ${statusClass(data.nextBooking.status)}`}>
            {data.nextBooking.status}
          </span>
        )}
      </div>

      {data.nextBooking ? (
        <Link href={`/bookings/${data.nextBooking.id}`} className="ride" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
          <div className="eyebrow" style={{ color: '#53472e' }}>
            {fmtDate(data.nextBooking.date).label}
          </div>
          <div className="time">{data.nextBooking.startTime} — {data.nextBooking.endTime}</div>
          <div className="meta">
            <span>◉ Arena 01</span>
            {data.membership?.plan && <span>♙ {data.membership.plan} Member</span>}
          </div>
        </Link>
      ) : (
        <div className="ride" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="eyebrow" style={{ color: '#53472e' }}>NO UPCOMING RIDE</div>
          <div className="time" style={{ fontSize: '22px', marginTop: '8px' }}>Book a session</div>
          <div className="meta"><span>Choose from available slots below</span></div>
        </div>
      )}

      {/* ── Quick Grid ── */}
      <div className="quick">
        <Link href="/schedule" style={{ textDecoration: 'none' }}>
          <span className="quickIcon"><Calendar size={18} strokeWidth={1.75} /></span>
          <span>Book a Ride</span>
        </Link>
        <Link href="/bookings" style={{ textDecoration: 'none' }}>
          <span className="quickIcon"><Ticket size={18} strokeWidth={1.75} /></span>
          <span>My Rides</span>
        </Link>
        <Link href="/membership" style={{ textDecoration: 'none' }}>
          <span className="quickIcon"><CreditCard size={18} strokeWidth={1.75} /></span>
          <span>Membership</span>
        </Link>
        <Link href="/profile" style={{ textDecoration: 'none' }}>
          <span className="quickIcon"><User size={18} strokeWidth={1.75} /></span>
          <span>Profile</span>
        </Link>
      </div>

      {/* ── BBS Quote ── */}
      <div className="quote">
        <strong>"A better you<br />rides here."</strong>
        <span>BORNEO BERKUDA STABLE</span>
      </div>

      {/* ── Upcoming ── */}
      {data.upcomingCount > 0 && (
        <>
          <div className="section">
            <b>Upcoming</b>
            <Link href="/bookings" className="section-link" style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>See all</Link>
          </div>
          <div className="list">
            {data.nextBooking && (() => {
              const d = fmtDate(data.nextBooking!.date);
              return (
                <Link href={`/bookings/${data.nextBooking!.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="date"><b>{d.day}</b><span>{d.mon}</span></div>
                  <div className="rowmain">
                    <b>{data.nextBooking!.startTime} — {data.nextBooking!.endTime}</b>
                    <span>Arena 01</span>
                  </div>
                  <span className={`pill ${statusClass(data.nextBooking!.status)}`}>{data.nextBooking!.status}</span>
                </Link>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
