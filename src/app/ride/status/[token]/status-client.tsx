'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  MapPin,
  MessageCircle,
  QrCode,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { TearableTicket } from '@/components/ui/tearable-ticket';
import { QrCodeSvg } from '@/components/ui/qr-code-svg';

export type GuestRideStatusViewModel = {
  id: string;
  humanId: string;
  publicToken: string;
  requestType: 'CASUAL_RIDE' | 'JOY_RIDE' | string;
  serviceName: string;
  status: 'UNDER_REVIEW' | 'CONFIRMED' | 'REJECTED' | string;
  riderName: string;
  riderPhone: string;
  preferredDate: string;
  preferredTime: string;
  heightCm: number;
  weightKg: number;
  shoeSize: number | null;
  guardianName: string | null;
  guardianPhone: string | null;
  priceIdr: number;
  createdAt: string;
  booking: {
    id: string;
    status: string;
    date: string;
    startTime: string;
    endTime: string | null;
    horseName: string | null;
    attendanceStatus: string;
  } | null;
};

const DAYS_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_FULL = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function formatDateIndonesian(dateStr: string): { dayName: string; fullDate: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { dayName: '-', fullDate: dateStr };
  }
  return {
    dayName: DAYS_FULL[d.getDay()],
    fullDate: `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`,
  };
}

function addOneHour(timeHm: string): string {
  const [hStr, mStr] = (timeHm || '08:00').split(':');
  const h = parseInt(hStr || '8', 10);
  const m = parseInt(mStr || '0', 10);
  const totalMins = h * 60 + m + 60;
  const eh = String(Math.floor(totalMins / 60)).padStart(2, '0');
  const em = String(totalMins % 60).padStart(2, '0');
  return `${eh}:${em}`;
}

export default function GuestRideStatusClient({
  data,
  adminWa,
}: {
  data: GuestRideStatusViewModel;
  adminWa: string;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const isConfirmed = data.status === 'CONFIRMED';
  const isRejected = data.status === 'REJECTED';
  const isAttended = data.booking?.attendanceStatus === 'ATTENDED';

  const activeDate = data.booking?.date || data.preferredDate;
  const activeStartTime = data.booking?.startTime || data.preferredTime;
  const activeEndTime = data.booking?.endTime || addOneHour(activeStartTime);
  const { dayName, fullDate } = formatDateIndonesian(activeDate);

  const normalizeWaNumber = (raw: string) => {
    const clean = String(raw || '').replace(/\D/g, '');
    if (!clean) return '628123194014';
    if (clean.startsWith('0')) return `62${clean.slice(1)}`;
    if (clean.startsWith('8')) return `62${clean}`;
    return clean;
  };

  const handleOpenWhatsApp = () => {
    const waPhone = normalizeWaNumber(adminWa);
    const ticketUrl = origin
      ? `${origin}/ride/status/${data.publicToken}`
      : `/ride/status/${data.publicToken}`;

    const messageLines = isConfirmed
      ? [
          `Halo Admin BBS, saya *${data.riderName}*.`,
          `Berikut E-Ticket reservasi *${data.serviceName}* saya yang sudah terkonfirmasi:`,
          `- Kode: *${data.humanId}*`,
          `- Jadwal: *${dayName}, ${fullDate} (${activeStartTime} - ${activeEndTime})*`,
          `- Link E-Ticket: ${ticketUrl}`,
        ]
      : [
          `Halo Admin BBS, saya *${data.riderName}* baru saja mengajukan reservasi *${data.serviceName}*:`,
          `- Kode Request: *${data.humanId}*`,
          `- Preferensi Jadwal: *${dayName}, ${fullDate} pukul ${activeStartTime}*`,
          `- Tarif Sesi: *Rp ${data.priceIdr.toLocaleString('id-ID')}*`,
          `- Link Status & Tiket: ${ticketUrl}`,
          ``,
          `Mohon konfirmasi ketersediaan jadwalnya ya Kak. Terima kasih!`,
        ];

    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(messageLines.join('\n'))}`;
    window.open(url, '_blank');
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    toast.custom((t) => (
      <AlertToast
        title="Link Tiket Disalin"
        description="Simpan link ini di WhatsApp atau catatan Anda untuk dibuka saat tiba di lokasi."
        onDismiss={() => toast.dismiss(t)}
      />
    ));
  };

  return (
    <div className="bbs-page-shell">
      {/* ── Hero Block with Real Photography + Dark Contrast Overlay ── */}
      <div className="bbs-hero-block">
        <Image
          src="/images/horse-4.png"
          alt="Borneo Berkuda Stable"
          fill
          sizes="520px"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority
        />
        <div className="bbs-hero-overlay" />

        <div className="bbs-hero-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <Link
              href="/ride"
              aria-label="Kembali ke form reservasi"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--r-md)',
                background: 'rgba(18, 18, 16, 0.72)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--surface)',
                textDecoration: 'none',
              }}
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </Link>

            <button
              type="button"
              onClick={() => router.refresh()}
              style={{
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 14px',
                borderRadius: 'var(--r-md)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(18, 18, 16, 0.72)',
                color: 'var(--surface)',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} strokeWidth={2} />
              <span>Perbarui Status</span>
            </button>
          </div>

          <div
            className="tabular-nums"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '1px',
              color: 'var(--gold)',
              marginBottom: '6px',
            }}
          >
            <span>TIKET #{data.humanId}</span>
          </div>

          <h1
            style={{
              font: '800 28px/1.15 var(--font-body, sans-serif)',
              margin: '0 0 8px',
              color: 'var(--surface)',
            }}
          >
            {isConfirmed
              ? 'E-Ticket Berkuda Anda'
              : isRejected
              ? 'Jadwal Belum Tersedia'
              : 'Menunggu Konfirmasi Admin'}
          </h1>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.85)',
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            {isConfirmed
              ? 'Tunjukkan QR Code di bawah kepada Groomer atau Admin saat tiba di kandang.'
              : isRejected
              ? 'Slot pada jam yang dipilih sedang penuh. Hubungi Admin lewat WhatsApp untuk jadwal pengganti.'
              : 'Admin akan menghubungi lewat WhatsApp setelah memeriksa ketersediaan kuda.'}
          </p>
        </div>
      </div>

      {/* ── Overlapping Boarding Pass / Status Cards ── */}
      <div className="bbs-overlap-container">
        {isConfirmed ? (
          <div style={{ width: '100%', maxWidth: '380px', margin: '0 auto' }}>
            <TearableTicket
              topContent={
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '20px',
                          fontWeight: 800,
                          color: 'var(--ink)',
                        }}
                      >
                        BBS PASS
                      </h3>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--muted)',
                          marginTop: '2px',
                          fontWeight: 700,
                        }}
                      >
                        Borneo Berkuda Stable
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span className="bbs-status-badge confirmed">
                        <CheckCircle2 size={14} strokeWidth={2} />
                        <span>Terkonfirmasi</span>
                      </span>
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: 'var(--muted)',
                        }}
                      >
                        {data.humanId}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--muted)',
                        marginBottom: '2px',
                      }}
                    >
                      {dayName}, {fullDate}
                    </div>

                    <div
                      className="tabular-nums"
                      style={{
                        font: '800 30px/1.15 var(--font-body, sans-serif)',
                        marginBottom: '20px',
                        color: 'var(--ink)',
                      }}
                    >
                      {activeStartTime} — {activeEndTime}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '14px',
                        paddingTop: '14px',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '2px' }}>
                          Rider (Tamu)
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                          {data.riderName}
                        </span>
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '2px' }}>
                          Layanan
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                          {data.serviceName}
                        </span>
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '2px' }}>
                          Kuda / Groom
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                          {data.booking?.horseName ? data.booking.horseName : 'Tim Groom BBS'}
                        </span>
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '2px' }}>
                          Tarif Sesi
                        </span>
                        <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                          Rp {data.priceIdr.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              }
              bottomContent={
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <QrCodeSvg value={`${origin}/checkin/${data.publicToken}`} size={160} />

                  <div className={`bbs-status-badge ${isAttended ? 'confirmed' : 'pending'}`}>
                    {isAttended ? (
                      <>
                        <CheckCircle2 size={14} strokeWidth={2} />
                        <span>Sudah Check-In (Hadir)</span>
                      </>
                    ) : (
                      <>
                        <QrCode size={14} strokeWidth={2} />
                        <span>Scan QR saat tiba di lokasi</span>
                      </>
                    )}
                  </div>

                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      letterSpacing: '1px',
                      textAlign: 'center',
                      color: 'var(--ink)',
                    }}
                  >
                    PASS {data.humanId} · ARENA 01
                  </div>
                </div>
              }
              stubContent={<span>BBS · GUEST RIDING PASS</span>}
            />
          </div>
        ) : (
          /* ── Status Card when UNDER_REVIEW or REJECTED ── */
          <div className="bbs-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span className={`bbs-status-badge ${isRejected ? 'rejected' : 'pending'}`}>
                {isRejected ? (
                  <>
                    <XCircle size={15} strokeWidth={2} />
                    <span>Ditolak / Jadwal Penuh</span>
                  </>
                ) : (
                  <>
                    <Clock size={15} strokeWidth={2} />
                    <span>Menunggu Konfirmasi</span>
                  </>
                )}
              </span>

              <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--muted)' }}>
                {data.humanId}
              </span>
            </div>

            <div
              style={{
                background: 'var(--surface-subtle)',
                borderRadius: 'var(--r-md)',
                padding: '16px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '4px' }}>
                Jadwal Preferensi
              </div>
              <div className="tabular-nums" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink)' }}>
                {activeStartTime} — {activeEndTime} WITA
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink-2)', marginTop: '2px' }}>
                {dayName}, {fullDate}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Nama Rider</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>{data.riderName}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Layanan</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>{data.serviceName}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Spesifikasi Rider</div>
                <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                  {data.heightCm} cm · {data.weightKg} kg
                  {data.shoeSize ? ` · EU ${data.shoeSize}` : ''}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Estimasi Tarif</div>
                <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                  Rp {data.priceIdr.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Secondary Location Info Card */}
        <div className="bbs-card-secondary" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <MapPin size={20} strokeWidth={2} color="var(--ink)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
              Panduan Kedatangan di Kandang
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, fontWeight: 500 }}>
              Hadir 15 menit sebelum jadwal sesi menggunakan celana panjang dan sepatu tertutup. Helm pengaman disediakan oleh Borneo Berkuda Stable.
            </p>
          </div>
        </div>
      </div>

      {/* ── Sticky Bottom Action Bar: 1 Dominant Primary Button + 1 Secondary Copy Button ── */}
      <div className="bbs-sticky-bottom-bar">
        <button
          type="button"
          onClick={handleCopyLink}
          className="bbs-btn-secondary"
          aria-label="Salin Link Tiket"
          style={{ padding: '0 16px' }}
        >
          <Copy size={18} strokeWidth={2} />
          <span>Salin Link</span>
        </button>

        <button
          type="button"
          onClick={handleOpenWhatsApp}
          className="bbs-btn-primary"
          style={{ flex: 1 }}
        >
          <MessageCircle size={18} strokeWidth={2} />
          <span>{isConfirmed ? 'Simpan ke WhatsApp' : 'Hubungi Admin via WA'}</span>
        </button>
      </div>
    </div>
  );
}
