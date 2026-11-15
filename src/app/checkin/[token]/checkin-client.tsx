'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  QrCode,
  ShieldAlert,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { confirmQrCheckinAction } from '../actions';

export type CheckinTicketViewModel = {
  requestId: string;
  humanId: string;
  publicToken: string;
  requestStatus: string;
  serviceName: string;
  riderName: string;
  riderPhone: string;
  riderType: 'CASUAL' | 'MEMBER';
  heightCm: number;
  weightKg: number;
  shoeSize: number | null;
  date: string;
  startTime: string;
  endTime: string | null;
  slotId: string | null;
  bookingId: string | null;
  participantId: string | null;
  priceIdr: number;
  horseId: string | null;
  horseName: string | null;
  attendanceStatus: 'ATTENDED' | 'NOT_CHECKED_IN' | string;
  checkedInAt: string | null;
};

export function CheckinClient({
  ticket,
  horses,
  actorRole,
}: {
  ticket: CheckinTicketViewModel;
  horses: { id: string; name: string }[];
  actorRole: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedHorseId, setSelectedHorseId] = useState<string>(ticket.horseId || '');
  const [isCheckedIn, setIsCheckedIn] = useState(ticket.attendanceStatus === 'ATTENDED');

  const backHref = actorRole === 'GROOMER' ? '/groomer' : '/admin/applications';

  const handleConfirmCheckin = () => {
    if (!ticket.participantId || !ticket.bookingId) {
      toast.custom((t) => (
        <AlertToast
          title="Tiket Belum Dikonfirmasi Admin"
          description="Permohonan ini masih berstatus UNDER_REVIEW dan belum memiliki jadwal booking aktif."
          variant="destructive"
          onDismiss={() => toast.dismiss(t)}
        />
      ));
      return;
    }

    startTransition(async () => {
      const res = await confirmQrCheckinAction({
        participantId: ticket.participantId!,
        bookingId: ticket.bookingId!,
        horseId: selectedHorseId || null,
        token: ticket.publicToken,
      });

      if (!res.ok) {
        toast.custom((t) => (
          <AlertToast
            title="Gagal Check-In"
            description={res.message || 'Terjadi kesalahan saat memproses check-in.'}
            variant="destructive"
            onDismiss={() => toast.dismiss(t)}
          />
        ));
        return;
      }

      setIsCheckedIn(true);
      toast.custom((t) => (
        <AlertToast
          title="Check-In Berhasil!"
          description={`${ticket.riderName} (${ticket.humanId}) tercatat HADIR untuk sesi ${ticket.startTime} WITA.`}
          onDismiss={() => toast.dismiss(t)}
        />
      ));
      router.refresh();
    });
  };

  return (
    <div
      style={{
        background: 'var(--paper)',
        minHeight: '100vh',
        maxWidth: '500px',
        margin: '0 auto',
        padding: '20px 20px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href={backHref}
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

        <Link
          href="/checkin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '999px',
            background: 'var(--white)',
            border: '1px solid #e0dfda',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--ink)',
            textDecoration: 'none',
          }}
        >
          <QrCode size={14} color="var(--gold)" />
          <span>Scan Tiket Lain</span>
        </Link>
      </div>

      {/* Header */}
      <div>
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
          VERIFIKASI E-TICKET · {ticket.humanId}
        </div>
        <h1 style={{ font: '32px/1.1 var(--font-display)', margin: 0, color: 'var(--ink)' }}>
          Check-In Rider
        </h1>
      </div>

      {/* Status Banner */}
      {ticket.requestStatus !== 'CONFIRMED' ? (
        <div
          style={{
            background: '#FEF3C7',
            border: '1.5px solid #F59E0B',
            borderRadius: '18px',
            padding: '16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <ShieldAlert size={24} color="#B45309" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#92400E' }}>
              Tiket Belum Disetujui Admin ({ticket.requestStatus})
            </div>
            <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px' }}>
              Setujui permohonan ini terlebih dahulu di menu Applications sebelum melakukan check-in.
            </div>
          </div>
        </div>
      ) : isCheckedIn ? (
        <div
          style={{
            background: '#DCFCE7',
            border: '1.5px solid #22C55E',
            borderRadius: '18px',
            padding: '16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <CheckCircle2 size={26} color="#15803D" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#14532D' }}>
              Rider Sudah Check-In (Hadir)
            </div>
            <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>
              Kehadiran sudah tercatat di sistem BBS. Anda masih dapat memperbarui kuda di bawah jika diperlukan.
            </div>
          </div>
        </div>
      ) : null}

      {/* Rider & Session Card */}
      <div
        style={{
          background: 'var(--white)',
          borderRadius: '22px',
          padding: '22px',
          border: '1px solid #EAE4D7',
          boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#FEF3C7',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '16px',
              }}
            >
              <User size={22} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
                {ticket.riderName}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                {ticket.riderPhone} · {ticket.riderType === 'CASUAL' ? 'Tamu (Non-Member)' : 'Member'}
              </div>
            </div>
          </div>

          <span
            style={{
              background: '#FDFBF7',
              border: '1px solid #E2D9C5',
              color: 'var(--ink)',
              fontSize: '11px',
              fontWeight: 800,
              padding: '5px 10px',
              borderRadius: '10px',
            }}
          >
            {ticket.serviceName}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            background: '#F9F6F0',
            padding: '14px',
            borderRadius: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="var(--gold)" />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Tanggal Sesi
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>{ticket.date}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--gold)" />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Jam Sesi
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>
                {ticket.startTime} {ticket.endTime ? `– ${ticket.endTime}` : 'WITA'}
              </div>
            </div>
          </div>
        </div>

        {/* Physical Specs & Price */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700 }}>TINGGI / BERAT</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px' }}>
              {ticket.heightCm}cm · {ticket.weightKg}kg
            </div>
          </div>
          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700 }}>UKURAN SEPATU</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px' }}>
              {ticket.shoeSize ? `EU ${ticket.shoeSize}` : '-'}
            </div>
          </div>
          <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700 }}>TARIF SESI</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px' }}>
              Rp {ticket.priceIdr.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        {/* Horse Assignment */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: '6px',
            }}
          >
            Pilih / Tugaskan Kuda (Opsional)
          </label>
          <select
            value={selectedHorseId}
            onChange={(e) => setSelectedHorseId(e.target.value)}
            style={{
              width: '100%',
              height: '46px',
              padding: '0 14px',
              borderRadius: '12px',
              border: '1.5px solid #E2D9C5',
              background: '#FFFDF9',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--ink)',
            }}
          >
            <option value="">— Belum Ditentukan (Tim Groom BBS) —</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                🐎 {h.name}
              </option>
            ))}
          </select>
        </div>

        {/* Primary Action Button */}
        {ticket.requestStatus === 'CONFIRMED' && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleConfirmCheckin}
            style={{
              width: '100%',
              height: '54px',
              borderRadius: '16px',
              border: 'none',
              background: isCheckedIn ? '#15803D' : 'var(--ink)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 800,
              cursor: isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            }}
          >
            {isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Memproses Check-In...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={19} />
                <span>
                  {isCheckedIn ? 'Perbarui Kuda & Konfirmasi Hadir' : 'Konfirmasi Check-In (Hadir)'}
                </span>
              </>
            )}
          </button>
        )}

        {ticket.slotId && actorRole === 'ADMIN' && (
          <Link
            href={`/admin/schedule/${ticket.slotId}`}
            style={{
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--gold)',
              textDecoration: 'none',
              paddingTop: '4px',
            }}
          >
            Lihat Detail Sesi di Jadwal Admin →
          </Link>
        )}
      </div>
    </div>
  );
}
