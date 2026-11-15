'use client';

import React, { useEffect, useState } from 'react';
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

function formatDateIndonesian(isoDate: string) {
  if (!isoDate) return { dayName: '-', fullDate: '-' };
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { dayName: '-', fullDate: isoDate };
  return {
    dayName: DAYS_FULL[d.getDay()],
    fullDate: `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`,
  };
}

function addOneHour(hm: string): string {
  if (!hm || !hm.includes(':')) return '';
  const [h, m] = hm.split(':').map(Number);
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
    const ticketUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/ride/status/${data.publicToken}`
        : `/ride/status/${data.publicToken}`;

    const messageLines = isConfirmed
      ? [
          `Halo Admin BBS, saya *${data.riderName}*.`,
          `Berikut E-Ticket reservasi *${data.serviceName}* saya yang sudah terkonfirmasi:`,
          `• Kode: *${data.humanId}*`,
          `• Jadwal: *${dayName}, ${fullDate} (${activeStartTime} - ${activeEndTime})*`,
          `• Link E-Ticket: ${ticketUrl}`,
        ]
      : [
          `Halo Admin BBS, saya *${data.riderName}* baru saja mengajukan reservasi *${data.serviceName}*:`,
          `• Kode Request: *${data.humanId}*`,
          `• Preferensi Jadwal: *${dayName}, ${fullDate} pukul ${activeStartTime}*`,
          `• Tarif Sesi: *Rp ${data.priceIdr.toLocaleString('id-ID')}*`,
          `• Link Status & Tiket: ${ticketUrl}`,
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
    <div
      style={{
        background: 'var(--paper)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '520px',
        margin: '0 auto',
        paddingBottom: '48px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 20px 12px',
        }}
      >
        <Link
          href="/ride"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--white)',
            border: '1px solid #e0dfda',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink)',
            textDecoration: 'none',
          }}
        >
          <ChevronLeft size={20} />
        </Link>

        <button
          type="button"
          onClick={() => router.refresh()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '100px',
            border: '1px solid #e0dfda',
            background: 'var(--white)',
            color: 'var(--ink)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} />
          <span>Perbarui Status</span>
        </button>
      </div>

      {/* Title Section */}
      <div style={{ padding: '4px 24px 20px' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            marginBottom: '4px',
          }}
        >
          {data.humanId}
        </div>
        <h1 style={{ font: '34px/1.05 var(--font-display)', margin: '0 0 6px', color: 'var(--ink)' }}>
          {isConfirmed
            ? 'Riding Pass Anda'
            : isRejected
            ? 'Jadwal Belum Tersedia'
            : 'Menunggu Konfirmasi'}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', margin: 0, lineHeight: 1.45 }}>
          {isConfirmed
            ? 'Tunjukkan E-Ticket ini kepada tim Groomer / Admin saat tiba di Borneo Berkuda Stable.'
            : isRejected
            ? 'Mohon maaf, slot pada jam yang Anda pilih sedang penuh atau berhalangan. Silakan hubungi Admin untuk jadwal alternatif.'
            : 'Permohonan Anda sudah masuk ke antrean Admin BBS. Klik tombol WhatsApp di bawah untuk mempercepat konfirmasi & menyimpan link tiket Anda.'}
        </p>
      </div>

      {/* Main Content: E-Ticket when CONFIRMED, Status Card when UNDER_REVIEW / REJECTED */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {isConfirmed ? (
          <div style={{ width: '100%', maxWidth: '360px', margin: '0 auto' }}>
            <TearableTicket
              topContent={
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '22px',
                          fontFamily: 'var(--font-display)',
                          color: 'var(--ink)',
                        }}
                      >
                        BBS
                      </h3>
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'var(--muted)',
                          marginTop: '2px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          letterSpacing: '1px',
                        }}
                      >
                        Borneo Berkuda Stable
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span
                        style={{
                          background: '#2E6F40',
                          color: '#fff',
                          fontSize: '9px',
                          fontWeight: 800,
                          padding: '5px 11px',
                          borderRadius: '12px',
                          letterSpacing: '0.5px',
                        }}
                      >
                        CONFIRMED
                      </span>
                      <span
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 800,
                          letterSpacing: '0.8px',
                          color: 'var(--muted)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {data.humanId}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '1px',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        marginBottom: '3px',
                      }}
                    >
                      {dayName}
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        borderBottom: '1px solid #e2dcd0',
                        paddingBottom: '4px',
                        display: 'inline-block',
                        marginBottom: '18px',
                        color: 'var(--ink)',
                      }}
                    >
                      {fullDate.toUpperCase()}
                    </div>

                    <div style={{ font: '42px/1 var(--font-display)', marginBottom: '22px', color: 'var(--ink)' }}>
                      {activeStartTime} — {activeEndTime}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '14px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '9px',
                            fontWeight: 600,
                            color: 'var(--muted)',
                            marginBottom: '3px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Rider (Tamu)
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                          {data.riderName}
                        </span>
                      </div>

                      <div>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '9px',
                            fontWeight: 600,
                            color: 'var(--muted)',
                            marginBottom: '3px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Layanan
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                          {data.serviceName}
                        </span>
                      </div>

                      <div>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '9px',
                            fontWeight: 600,
                            color: 'var(--muted)',
                            marginBottom: '3px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Kuda / Groom
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                          {data.booking?.horseName ? `${data.booking.horseName} · Tim BBS` : 'Tim Groom BBS'}
                        </span>
                      </div>

                      <div>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '9px',
                            fontWeight: 600,
                            color: 'var(--muted)',
                            marginBottom: '3px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Tarif Sesi
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>
                          Rp {data.priceIdr.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              }
              bottomContent={
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <QrCodeSvg
                    value={`${origin}/checkin/${data.publicToken}`}
                    size={154}
                  />
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background:
                        data.booking?.attendanceStatus === 'ATTENDED' ? '#DCFCE7' : '#F3EFE6',
                      color:
                        data.booking?.attendanceStatus === 'ATTENDED' ? '#15803D' : '#6B5E45',
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {data.booking?.attendanceStatus === 'ATTENDED'
                      ? '✓ SUDAH CHECK-IN (HADIR)'
                      : 'SCAN QR OLEH GROOMER / ADMIN SAAT TIBA'}
                  </div>
                  <div
                    style={{
                      fontSize: '8px',
                      fontWeight: 800,
                      letterSpacing: '1.6px',
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      color: '#181817',
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
          <div
            style={{
              background: 'linear-gradient(145deg, #FFFDF9 0%, #F6EFE2 100%)',
              borderRadius: '24px',
              padding: '24px',
              border: '1px solid #E6DEC8',
              boxShadow: '0 10px 28px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                {data.serviceName}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isRejected ? '#FEE2E2' : '#FEF3C7',
                  color: isRejected ? '#B91C1C' : '#92400E',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '5px 12px',
                  borderRadius: '100px',
                }}
              >
                {isRejected ? <XCircle size={13} /> : <Clock size={13} />}
                <span>{isRejected ? 'DITOLAK / PENUH' : 'MENUNGGU KONFIRMASI'}</span>
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
                Preferensi Jadwal Berkuda
              </div>
              <div style={{ font: '32px/1.1 var(--font-display)', color: 'var(--ink)' }}>
                {dayName}, {fullDate}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--gold)',
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Calendar size={17} />
                <span>Pukul {activeStartTime} WITA</span>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.75)',
                borderRadius: '16px',
                padding: '14px 16px',
                border: '1px solid #EAE2D3',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Nama Rider
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginTop: '2px' }}>
                  {data.riderName}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Estimasi Tarif
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px' }}>
                  Rp {data.priceIdr.toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Profil Fisik
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                  {data.heightCm} cm · {data.weightKg} kg
                  {data.shoeSize ? ` · EUR ${data.shoeSize}` : ''}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Kode Tiket
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginTop: '2px' }}>
                  {data.humanId}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Arrival & Location Guide */}
        <div
          style={{
            background: 'var(--white)',
            borderRadius: '18px',
            padding: '16px',
            border: '1px solid #e6e2d8',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#fbf8f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--gold)',
              flexShrink: 0,
            }}
          >
            <MapPin size={18} />
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>Petunjuk Kedatangan BBS</div>
            <span style={{ color: 'var(--muted)' }}>
              Mohon hadir <b>15 menit sebelum sesi dimulai</b> untuk fitting helm, boots, dan pengenalan dengan kuda. Gunakan celana panjang yang nyaman.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            style={{
              width: '100%',
              height: '54px',
              background: '#25D366',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '16px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 6px 18px rgba(37, 211, 102, 0.25)',
            }}
          >
            <MessageCircle size={20} />
            <span>
              {isConfirmed
                ? 'Simpan Link Tiket ke WhatsApp'
                : 'Konfirmasi & Simpan Link via WhatsApp'}
            </span>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                height: '48px',
                background: 'var(--white)',
                color: 'var(--ink)',
                border: '1px solid #e0dfda',
                borderRadius: '14px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Copy size={16} />
              <span>Salin Link Tiket</span>
            </button>

            <Link
              href="/ride"
              style={{
                height: '48px',
                background: 'var(--white)',
                color: 'var(--ink)',
                border: '1px solid #e0dfda',
                borderRadius: '14px',
                fontSize: '13.5px',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} color="var(--gold)" />
              <span>Pesan Sesi Lain</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
