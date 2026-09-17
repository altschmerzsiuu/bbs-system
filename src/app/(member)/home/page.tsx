import Link from 'next/link';
import { TopBar } from '@/components/member/top-bar';
import { getMemberHome } from '@/modules/bookings/booking-queries';
import { requireActor } from '@/lib/auth';
import { FCMRegistrar } from '@/modules/notifications/components/fcm-registrar';

const DAYS_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ABR = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${DAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS_ABR[d.getMonth()]}`;
}

export default async function MemberHomePage() {
  const actor = await requireActor(['MEMBER']);
  const data = await getMemberHome(actor.memberId!);
  const firstName = data.memberName.split(' ')[0];

  return (
    <div>
      <TopBar userName={firstName} memberTier={data.membership?.plan} />

      <div className="px-5 mt-4">
        <FCMRegistrar />
      </div>

      <div className="hero mt-4">
        <div className="tag">Sesi berikutnya</div>
        {data.nextBooking ? (
          <>
            <div className="big">{data.nextBooking.startTime} — {data.nextBooking.endTime}</div>
            <div className="sub">{formatDate(data.nextBooking.date)}</div>
            <div className="row">
              <span className="chip-state">{data.nextBooking.status}</span>
              <Link href={`/bookings/${data.nextBooking.id}`}>
                <button className="fab">→</button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="big">Belum ada sesi</div>
            <div className="sub">Pilih jadwal berkuda Anda</div>
            <div className="row">
              <Link href="/schedule">
                <button className="fab">→</button>
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="stats">
        <div className="stat g">
          <div className="ic">🎟️</div>
          <b>{data.membership?.available ?? 0}</b>
          <span>Kredit tersisa</span>
        </div>
        <div className="stat s">
          <div className="ic">📅</div>
          <b>{data.upcomingCount}</b>
          <span>Booking mendatang</span>
        </div>
      </div>

      <div className="sec">
        <h3>Membership</h3>
        <Link href="/membership">Detail</Link>
      </div>

      <div className="card">
        <div className="date">
          <b>{data.membership?.available ?? 0}</b>
          <span>SESI</span>
        </div>
        <div className="body">
          {data.membership ? (
            <>
              <b>{data.membership.plan} Plan</b>
              <span>Berakhir {formatDate(data.membership.endDate)}</span>
            </>
          ) : data.pendingApplication ? (
            <>
              <b>Aplikasi {data.pendingApplication.planName}</b>
              <span style={{ color: data.pendingApplication.status === 'APPROVED' ? '#4CAF50' : 'var(--gold-deep)' }}>
                {data.pendingApplication.status.replace('_', ' ')}
              </span>
            </>
          ) : (
            <>
              <b>Belum Ada Membership</b>
              <span>Beli paket membership</span>
            </>
          )}
        </div>
      </div>

      <Link href="/schedule">
        <button className="btn gold">Book a ride</button>
      </Link>
    </div>
  );
}
