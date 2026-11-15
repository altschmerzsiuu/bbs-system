'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Loader2,
  Search,
  ShieldCheck,
  Ticket,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { submitGuestRequest, lookupGuestTicketAction } from './actions';

export type RideProductItem = {
  code: string;
  name: string;
  description: string;
  price_idr: number;
};

const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const GUEST_STORAGE_KEY = 'bbs_guest_profile_v1';

function computeAgeFromDob(dobStr: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(`${dobStr}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default function GuestRideForm({
  products,
  slots,
  initialMode,
  initialTab = 'book',
}: {
  products: RideProductItem[];
  slots: any[];
  initialMode: string;
  initialTab?: 'book' | 'check';
  adminWa: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'book' | 'check'>(initialTab);
  const [requestType, setRequestType] = useState<string>(
    initialMode === 'JOY_RIDE' ? 'JOY_RIDE' : 'CASUAL_RIDE'
  );

  // Controlled fields for prefill & inline validation
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [domicile, setDomicile] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [isReturningGuest, setIsReturningGuest] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [waiverAccepted, setWaiverAccepted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Ticket lookup state
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  // Auto-prefill for returning guests
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GUEST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.fullName) setFullName(parsed.fullName);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.dateOfBirth) setDateOfBirth(parsed.dateOfBirth);
        if (parsed.domicile) setDomicile(parsed.domicile);
        if (parsed.heightCm) setHeightCm(String(parsed.heightCm));
        if (parsed.weightKg) setWeightKg(String(parsed.weightKg));
        if (parsed.shoeSize) setShoeSize(String(parsed.shoeSize));
        if (parsed.fullName || parsed.phone) setIsReturningGuest(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const riderAge = useMemo(() => computeAgeFromDob(dateOfBirth), [dateOfBirth]);
  const requiresGuardian = riderAge !== null && riderAge >= 0 && riderAge < 17;

  const availableDates = useMemo(() => {
    const unique = Array.from(new Set((slots || []).map((s) => s.slot_date))).sort();
    if (unique.length > 0) return unique;
    const list: string[] = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  }, [slots]);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const timeOptions = useMemo(() => {
    if (!selectedDate) return [];
    const slotTimes = Array.from(
      new Set(
        (slots || [])
          .filter((s) => s.slot_date === selectedDate && s.is_open !== false)
          .map((s) => String(s.start_time).slice(0, 5))
      )
    ).sort();

    const rawList =
      slotTimes.length > 0
        ? slotTimes
        : ['07:00', '08:00', '09:00', '10:00', '14:00', '15:00', '16:00', '17:00'];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    const currentHm = now.toTimeString().slice(0, 5);

    return rawList.map((hm) => {
      const isPastToday = selectedDate === todayStr && hm <= currentHm;
      const isPastDate = selectedDate < todayStr;
      return {
        value: hm,
        disabled: Boolean(isPastToday || isPastDate),
      };
    });
  }, [selectedDate, slots]);

  useEffect(() => {
    if (selectedTime) {
      const stillValid = timeOptions.find((t) => t.value === selectedTime && !t.disabled);
      if (!stillValid) {
        setSelectedTime('');
      }
    }
  }, [timeOptions, selectedTime]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.code === requestType) || products[0],
    [products, requestType]
  );

  const validateClientSide = (): boolean => {
    const nextErrs: Record<string, string> = {};
    if (!selectedDate || !selectedTime) {
      nextErrs.schedule = 'Pilih tanggal dan jam sesi terlebih dahulu.';
    }
    if (fullName.trim().length < 2) {
      nextErrs.fullName = 'Nama lengkap minimal 2 karakter.';
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      nextErrs.phone = 'Masukkan nomor WhatsApp aktif (contoh: 081234567890).';
    }
    if (!dateOfBirth) {
      nextErrs.dateOfBirth = 'Tanggal lahir wajib diisi untuk penyesuaian kuda.';
    }
    const hNum = Number(heightCm);
    if (!heightCm || Number.isNaN(hNum) || hNum < 80 || hNum > 230) {
      nextErrs.heightCm = 'Tinggi badan harus antara 80–230 cm.';
    }
    const wNum = Number(weightKg);
    if (!weightKg || Number.isNaN(wNum) || wNum < 15 || wNum > 150) {
      nextErrs.weightKg = 'Berat badan harus antara 15–150 kg.';
    }
    if (requiresGuardian) {
      if (guardianName.trim().length < 2) {
        nextErrs.guardianName = 'Nama orang tua / wali wajib diisi untuk rider di bawah 17 tahun.';
      }
      if (guardianPhone.replace(/\D/g, '').length < 9) {
        nextErrs.guardianPhone = 'Nomor WhatsApp wali wajib diisi.';
      }
    }
    if (!waiverAccepted) {
      nextErrs.waiver = 'Centang persetujuan keselamatan berkuda (waiver) sebelum mengirim.';
    }
    setFieldErrors(nextErrs);
    return Object.keys(nextErrs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!validateClientSide()) {
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set('requestType', requestType);
    formData.set('preferredDate', selectedDate);
    formData.set('preferredTime', selectedTime);
    formData.set('waiverAccepted', waiverAccepted ? 'true' : 'false');

    try {
      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          dateOfBirth,
          domicile: domicile.trim(),
          heightCm,
          weightKg,
          shoeSize,
        })
      );
    } catch {
      // Ignore storage errors
    }

    try {
      const res = await submitGuestRequest(formData);
      if (!res.ok) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      toast.custom((t) => (
        <AlertToast
          title="Permohonan Terkirim"
          description={`Kode: ${res.requestId}. Admin akan menghubungi lewat WhatsApp.`}
          onDismiss={() => toast.dismiss(t)}
        />
      ));
      router.push(`/ride/status/${res.publicToken}`);
    } catch {
      setError('Gagal terhubung ke server. Periksa koneksi internet dan coba lagi.');
      setIsSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLookupError(null);
    setIsLookingUp(true);
    const formData = new FormData(e.currentTarget);

    try {
      const res = await lookupGuestTicketAction(formData);
      if (!res.ok) {
        setLookupError(res.error);
        setIsLookingUp(false);
        return;
      }
      router.push(`/ride/status/${res.publicToken}`);
    } catch {
      setLookupError('Gagal memeriksa status tiket. Periksa koneksi internet Anda.');
      setIsLookingUp(false);
    }
  };

  return (
    <div suppressHydrationWarning className="bbs-page-shell">
      {/* ── Hero Block with Real Photography + Dark Contrast Overlay ── */}
      <div className="bbs-hero-block">
        <Image
          src="/images/horse-4.png"
          alt="Borneo Berkuda Stable Arena"
          fill
          sizes="520px"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority
        />
        <div className="bbs-hero-overlay" />

        <div className="bbs-hero-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <Link
              href="/login"
              aria-label="Kembali ke halaman login"
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

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: 'var(--r-sm)',
                background: 'rgba(18, 18, 16, 0.72)',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--gold)',
                }}
              />
              <span>RESERVASI TAMU</span>
            </div>
          </div>

          <h1
            style={{
              font: '800 28px/1.15 var(--font-body, sans-serif)',
              margin: '0 0 6px',
              color: 'var(--surface)',
            }}
          >
            {activeTab === 'book' ? 'Pesan Sesi Berkuda' : 'Cek Status & E-Ticket'}
          </h1>
          <p
            style={{
              margin: '0 0 20px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: 1.45,
            }}
          >
            {activeTab === 'book'
              ? 'Pilih jadwal preferensi Anda. Admin akan mengonfirmasi slot lewat WhatsApp.'
              : 'Masukkan nomor WhatsApp atau kode REQ-XXXX untuk membuka E-Ticket Anda.'}
          </p>

          {/* Segmented Tab Switcher (44px height) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              background: 'rgba(18, 18, 16, 0.75)',
              padding: '4px',
              borderRadius: 'var(--r-md)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('book')}
              style={{
                minHeight: '44px',
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: activeTab === 'book' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'book' ? 'var(--ink)' : 'rgba(255,255,255,0.8)',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Calendar size={16} strokeWidth={2} />
              <span>Pesan Sesi Baru</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('check')}
              style={{
                minHeight: '44px',
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: activeTab === 'check' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'check' ? 'var(--ink)' : 'rgba(255,255,255,0.8)',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Ticket size={16} strokeWidth={2} />
              <span>Cek Tiket Saya</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Overlapping Cards Container ── */}
      <div className="bbs-overlap-container">
        {activeTab === 'check' ? (
          <form onSubmit={handleLookup} className="bbs-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h2 style={{ font: '800 18px/1.25 var(--font-body, sans-serif)', margin: '0 0 4px', color: 'var(--ink)' }}>
                Cari E-Ticket Anda
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
                Gunakan nomor WhatsApp saat memesan dan kode tiket opsional.
              </p>
            </div>

            {lookupError && (
              <div
                style={{
                  background: 'var(--danger-soft)',
                  color: 'var(--danger)',
                  padding: '12px 14px',
                  borderRadius: 'var(--r-sm)',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {lookupError}
              </div>
            )}

            <div>
              <label htmlFor="lookup-phone" className="bbs-field-label">
                Nomor WhatsApp
              </label>
              <input
                id="lookup-phone"
                type="tel"
                name="phone"
                inputMode="tel"
                required
                defaultValue={phone}
                placeholder="Contoh: 081234567890"
                className="bbs-input tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="lookup-code" className="bbs-field-label">
                Kode Tiket (Opsional)
              </label>
              <input
                id="lookup-code"
                type="text"
                name="code"
                placeholder="Contoh: REQ-4821"
                className="bbs-input tabular-nums"
              />
            </div>

            <button type="submit" disabled={isLookingUp} className="bbs-btn-primary" style={{ width: '100%' }}>
              {isLookingUp ? (
                <>
                  <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                  <span>Mencari Tiket...</span>
                </>
              ) : (
                <>
                  <Search size={18} strokeWidth={2} />
                  <span>Buka Status & E-Ticket</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form id="guest-ride-form" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Honeypot */}
            <input
              type="text"
              name="website_url"
              tabIndex={-1}
              autoComplete="off"
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
            />

            {/* 1. Primary Card: Pilih Layanan & Jadwal */}
            <div className="bbs-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)', marginBottom: '10px' }}>
                  1. PILIH JENIS LAYANAN
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {products.map((prod) => {
                    const isSelected = requestType === prod.code;
                    return (
                      <button
                        key={prod.code}
                        type="button"
                        onClick={() => setRequestType(prod.code)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '16px',
                          borderRadius: 'var(--r-md)',
                          border: isSelected ? '2px solid var(--ink)' : '1.5px solid var(--border)',
                          background: isSelected ? 'var(--ink)' : 'var(--surface)',
                          color: isSelected ? 'var(--surface)' : 'var(--ink)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: isSelected ? 'var(--gold)' : 'var(--border-strong)',
                              }}
                            />
                            <span style={{ fontSize: '15px', fontWeight: 800 }}>{prod.name}</span>
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              color: isSelected ? 'rgba(255,255,255,0.78)' : 'var(--muted)',
                              lineHeight: 1.4,
                            }}
                          >
                            {prod.description}
                          </div>
                        </div>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: '16px',
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Rp {prod.price_idr.toLocaleString('id-ID')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pilih Tanggal */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)', marginBottom: '10px' }}>
                  2. PILIH TANGGAL & JAM PREFERENSI
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '6px',
                  }}
                >
                  {availableDates.map((dStr) => {
                    const d = new Date(`${dStr}T00:00:00`);
                    const isSelected = selectedDate === dStr;
                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => setSelectedDate(dStr)}
                        style={{
                          minWidth: '68px',
                          minHeight: '68px',
                          padding: '10px 8px',
                          borderRadius: 'var(--r-md)',
                          border: isSelected ? '2px solid var(--ink)' : '1.5px solid var(--border)',
                          background: isSelected ? 'var(--ink)' : 'var(--surface)',
                          color: isSelected ? 'var(--surface)' : 'var(--ink)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: isSelected ? 'rgba(255,255,255,0.78)' : 'var(--muted)',
                          }}
                        >
                          {DAYS_SHORT[d.getDay()]}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: '20px', fontWeight: 800 }}>
                          {d.getDate()}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: isSelected ? 'var(--gold)' : 'var(--muted)',
                          }}
                        >
                          {MONTHS_SHORT[d.getMonth()]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Pilih Jam */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    marginTop: '12px',
                  }}
                >
                  {timeOptions.map((slot) => {
                    const isSelected = selectedTime === slot.value;
                    return (
                      <button
                        key={slot.value}
                        type="button"
                        disabled={slot.disabled}
                        onClick={() => {
                          setSelectedTime(slot.value);
                          setFieldErrors((prev) => ({ ...prev, schedule: '' }));
                        }}
                        className="tabular-nums"
                        style={{
                          minHeight: '44px',
                          borderRadius: 'var(--r-sm)',
                          border: isSelected ? '2px solid var(--ink)' : '1.5px solid var(--border)',
                          background: slot.disabled
                            ? 'var(--surface-subtle)'
                            : isSelected
                            ? 'var(--ink)'
                            : 'var(--surface)',
                          color: slot.disabled
                            ? 'var(--border-strong)'
                            : isSelected
                            ? 'var(--surface)'
                            : 'var(--ink)',
                          fontSize: '14px',
                          fontWeight: 800,
                          cursor: slot.disabled ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                        }}
                      >
                        <Clock size={14} strokeWidth={2} />
                        <span>{slot.value}</span>
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.schedule && <div className="bbs-field-error">{fieldErrors.schedule}</div>}
              </div>
            </div>

            {/* 2. Secondary Card: Data Diri & Spesifikasi Rider */}
            <div className="bbs-card-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)' }}>
                  3. DATA RIDER & UKURAN KUDA
                </span>
                {isReturningGuest && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--success)',
                    }}
                  >
                    <UserCheck size={14} strokeWidth={2} />
                    <span>Data tersimpan</span>
                  </span>
                )}
              </div>

              <div>
                <label htmlFor="guest-fullName" className="bbs-field-label">
                  Nama Lengkap Rider
                </label>
                <input
                  id="guest-fullName"
                  type="text"
                  name="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  className={`bbs-input ${fieldErrors.fullName ? 'has-error' : ''}`}
                />
                {fieldErrors.fullName && <div className="bbs-field-error">{fieldErrors.fullName}</div>}
              </div>

              <div>
                <label htmlFor="guest-phone" className="bbs-field-label">
                  Nomor WhatsApp Aktif
                </label>
                <input
                  id="guest-phone"
                  type="tel"
                  name="phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className={`bbs-input tabular-nums ${fieldErrors.phone ? 'has-error' : ''}`}
                />
                {fieldErrors.phone && <div className="bbs-field-error">{fieldErrors.phone}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="guest-dob" className="bbs-field-label">
                    Tanggal Lahir
                  </label>
                  <input
                    id="guest-dob"
                    type="date"
                    name="dateOfBirth"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className={`bbs-input tabular-nums ${fieldErrors.dateOfBirth ? 'has-error' : ''}`}
                  />
                  {fieldErrors.dateOfBirth && <div className="bbs-field-error">{fieldErrors.dateOfBirth}</div>}
                </div>

                <div>
                  <label htmlFor="guest-domicile" className="bbs-field-label">
                    Domisili / Kota
                  </label>
                  <input
                    id="guest-domicile"
                    type="text"
                    name="domicile"
                    value={domicile}
                    onChange={(e) => setDomicile(e.target.value)}
                    placeholder="Contoh: Balikpapan"
                    className="bbs-input"
                  />
                </div>
              </div>

              {/* Guardian Conditional Section for Riders < 17 */}
              {requiresGuardian && (
                <div
                  style={{
                    background: 'var(--surface-subtle)',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 'var(--r-md)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ink)' }}>
                    Data Orang Tua / Wali (Rider Usia {riderAge} Tahun)
                  </div>
                  <div>
                    <label htmlFor="guest-guardianName" className="bbs-field-label">
                      Nama Orang Tua / Wali
                    </label>
                    <input
                      id="guest-guardianName"
                      type="text"
                      name="guardianName"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Nama lengkap wali"
                      className={`bbs-input ${fieldErrors.guardianName ? 'has-error' : ''}`}
                    />
                    {fieldErrors.guardianName && (
                      <div className="bbs-field-error">{fieldErrors.guardianName}</div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="guest-guardianPhone" className="bbs-field-label">
                      Nomor WhatsApp Wali
                    </label>
                    <input
                      id="guest-guardianPhone"
                      type="tel"
                      name="guardianPhone"
                      inputMode="tel"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className={`bbs-input tabular-nums ${fieldErrors.guardianPhone ? 'has-error' : ''}`}
                    />
                    {fieldErrors.guardianPhone && (
                      <div className="bbs-field-error">{fieldErrors.guardianPhone}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Numeric Specs with Unit Suffix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label htmlFor="guest-height" className="bbs-field-label">
                    Tinggi Badan
                  </label>
                  <div className="bbs-input-wrap">
                    <input
                      id="guest-height"
                      type="text"
                      inputMode="numeric"
                      name="heightCm"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value.replace(/[^\d.]/g, ''))}
                      placeholder="165"
                      style={{ paddingRight: '38px' }}
                      className={`bbs-input tabular-nums ${fieldErrors.heightCm ? 'has-error' : ''}`}
                    />
                    <span className="bbs-input-suffix">cm</span>
                  </div>
                  {fieldErrors.heightCm && <div className="bbs-field-error">{fieldErrors.heightCm}</div>}
                </div>

                <div>
                  <label htmlFor="guest-weight" className="bbs-field-label">
                    Berat Badan
                  </label>
                  <div className="bbs-input-wrap">
                    <input
                      id="guest-weight"
                      type="text"
                      inputMode="numeric"
                      name="weightKg"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value.replace(/[^\d.]/g, ''))}
                      placeholder="60"
                      style={{ paddingRight: '36px' }}
                      className={`bbs-input tabular-nums ${fieldErrors.weightKg ? 'has-error' : ''}`}
                    />
                    <span className="bbs-input-suffix">kg</span>
                  </div>
                  {fieldErrors.weightKg && <div className="bbs-field-error">{fieldErrors.weightKg}</div>}
                </div>

                <div>
                  <label htmlFor="guest-shoe" className="bbs-field-label">
                    Sepatu (Ops)
                  </label>
                  <div className="bbs-input-wrap">
                    <input
                      id="guest-shoe"
                      type="text"
                      inputMode="numeric"
                      name="shoeSize"
                      value={shoeSize}
                      onChange={(e) => setShoeSize(e.target.value.replace(/\D/g, ''))}
                      placeholder="40"
                      style={{ paddingRight: '36px' }}
                      className="bbs-input tabular-nums"
                    />
                    <span className="bbs-input-suffix">EU</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Safety Waiver Card */}
            <div className="bbs-card-secondary">
              <button
                type="button"
                onClick={() => {
                  setWaiverAccepted((v) => !v);
                  setFieldErrors((prev) => ({ ...prev, waiver: '' }));
                }}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    border: waiverAccepted ? '2px solid var(--ink)' : '2px solid var(--border-strong)',
                    background: waiverAccepted ? 'var(--ink)' : 'var(--surface)',
                    color: 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {waiverAccepted && <Check size={16} strokeWidth={2.5} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>
                    <ShieldCheck size={16} strokeWidth={2} color="var(--success)" />
                    <span>Persetujuan Keselamatan Berkuda (Waiver)</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.45, fontWeight: 500 }}>
                    Saya bersedia mematuhi instruksi pelatih/groomer Borneo Berkuda Stable dan wajib menggunakan helm pengaman selama di area arena.
                  </p>
                </div>
              </button>
              {fieldErrors.waiver && <div className="bbs-field-error">{fieldErrors.waiver}</div>}
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--danger-soft)',
                  color: 'var(--danger)',
                  padding: '12px 16px',
                  borderRadius: 'var(--r-md)',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                {error}
              </div>
            )}

            {/* ── Sticky Bottom Action Bar: Summary Left, 1 Dominant Primary Button Right ── */}
            <div className="bbs-sticky-bottom-bar">
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
                  {selectedProduct?.name || 'Casual Ride'}
                </div>
                <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)' }}>
                  Rp {(selectedProduct?.price_idr || 250000).toLocaleString('id-ID')}
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="bbs-btn-primary">
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Permohonan</span>
                    <ArrowRight size={18} strokeWidth={2} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
