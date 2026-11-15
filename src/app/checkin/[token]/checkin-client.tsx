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
          description="Permohonan ini masih berstatus menunggu dan belum memiliki jadwal booking aktif."
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
          title="Check-In Berhasil"
          description={`${ticket.riderName} (${ticket.humanId}) tercatat HADIR untuk sesi ${ticket.startTime} WITA.`}
          onDismiss={() => toast.dismiss(t)}
        />
      ));
      router.refresh();
    });
  };

  return (
    <div className="bbs-page-shell">
      {/* Dark Contrast Header Block */}
      <div className="bbs-hero-block">
        <div className="bbs-hero-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <Link
              href={backHref}
              aria-label="Kembali"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--r-md)',
                background: 'rgba(255, 255, 255, 0.12)',
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

            <Link
              href="/checkin"
              style={{
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 14px',
                borderRadius: 'var(--r-md)',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '13px',
                fontWeight: 800,
                color: 'var(--surface)',
                textDecoration: 'none',
              }}
            >
              <QrCode size={16} strokeWidth={2} color="var(--gold)" />
              <span>Scan Tiket Lain</span>
            </Link>
          </div>

          <div
            className="tabular-nums"
            style={{
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '1px',
              color: 'var(--gold)',
              marginBottom: '6px',
            }}
          >
            VERIFIKASI E-TICKET · {ticket.humanId}
          </div>
          <h1
            style={{
              font: '800 28px/1.15 var(--font-body, sans-serif)',
              margin: 0,
              color: 'var(--surface)',
            }}
          >
            Check-In Kehadiran Rider
          </h1>
        </div>
      </div>

      {/* Overlapping Slide-Up Sheet */}
      <div className="bbs-overlap-container bbs-bottom-sheet">
        <div className="bbs-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Status Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            {ticket.requestStatus !== 'CONFIRMED' ? (
              <span className="bbs-status-badge pending">
                <ShieldAlert size={15} strokeWidth={2} />
                <span>Belum Disetujui Admin</span>
              </span>
            ) : isCheckedIn ? (
              <span className="bbs-status-badge confirmed">
                <CheckCircle2 size={15} strokeWidth={2} />
                <span>Sudah Check-In (Hadir)</span>
              </span>
            ) : (
              <span className="bbs-status-badge pending">
                <Clock size={15} strokeWidth={2} />
                <span>Siap Check-In</span>
              </span>
            )}

            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--ink-2)',
                padding: '4px 10px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
              }}
            >
              {ticket.serviceName}
            </span>
          </div>

          {/* Rider Identity */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--r-md)',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <User size={22} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
                {ticket.riderName}
              </div>
              <div className="tabular-nums" style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
                {ticket.riderPhone} · {ticket.riderType === 'CASUAL' ? 'Tamu Non-Member' : 'Member'}
              </div>
            </div>
          </div>

          {/* Schedule Block */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              background: 'var(--surface-subtle)',
              padding: '14px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={18} strokeWidth={2} color="var(--ink)" />
              <div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Tanggal Sesi</div>
                <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                  {ticket.date}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} strokeWidth={2} color="var(--ink)" />
              <div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Jam Sesi</div>
                <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)' }}>
                  {ticket.startTime} {ticket.endTime ? `– ${ticket.endTime}` : 'WITA'}
                </div>
              </div>
            </div>
          </div>

          {/* Physical Specs & Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div
              style={{
                background: 'var(--surface-subtle)',
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Tinggi / Berat</div>
              <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px' }}>
                {ticket.heightCm} cm · {ticket.weightKg} kg
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface-subtle)',
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Sepatu</div>
              <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px' }}>
                {ticket.shoeSize ? `EU ${ticket.shoeSize}` : '-'}
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface-subtle)',
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Tarif Sesi</div>
              <div className="tabular-nums" style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px' }}>
                Rp {ticket.priceIdr.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Horse Selector (No Emoji) */}
          <div>
            <label htmlFor="checkin-horse-select" className="bbs-field-label">
              Pilih / Tugaskan Kuda (Opsional)
            </label>
            <select
              id="checkin-horse-select"
              value={selectedHorseId}
              onChange={(e) => setSelectedHorseId(e.target.value)}
              className="bbs-input"
            >
              <option value="">Belum Ditentukan (Tim Groom BBS)</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Single Dominant Primary Action */}
          {ticket.requestStatus === 'CONFIRMED' && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirmCheckin}
              className="bbs-btn-primary"
              style={{
                width: '100%',
                background: isCheckedIn ? 'var(--success)' : 'var(--ink)',
              }}
            >
              {isPending ? (
                <>
                  <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                  <span>Memproses Check-In...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} strokeWidth={2} />
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
              className="bbs-btn-secondary"
              style={{ width: '100%' }}
            >
              <span>Lihat Detail Sesi di Jadwal Admin</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
