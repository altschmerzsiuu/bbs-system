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
  Lock,
  Search,
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

type SavedLastTicket = {
  publicToken: string;
  humanId: string;
  serviceName: string;
  preferredDate: string;
  preferredTime: string;
};

const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const GUEST_STORAGE_KEY = 'bbs_guest_profile_v1';
const LAST_TICKET_STORAGE_KEY = 'bbs_last_ticket_v1';

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

/**
 * Automatically capitalizes the first letter of each word for text fields.
 */
function capitalizeWords(input: string): string {
  return input.replace(/(^|\s)([a-z])/g, (_, space, char) => `${space}${char.toUpperCase()}`);
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
  const [step, setStep] = useState<1 | 2>(1);
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Ticket lookup state
  const [lookupPhone, setLookupPhone] = useState<string>('');
  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lastTicket, setLastTicket] = useState<SavedLastTicket | null>(null);

  // Auto-prefill for returning guests + load last ticket on this device
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GUEST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.fullName) setFullName(capitalizeWords(String(parsed.fullName)));
        if (parsed.phone) {
          const cleanPhone = String(parsed.phone).replace(/\D/g, '');
          setPhone(cleanPhone);
          setLookupPhone(cleanPhone);
        }
        if (parsed.dateOfBirth) setDateOfBirth(parsed.dateOfBirth);
        if (parsed.domicile) setDomicile(capitalizeWords(String(parsed.domicile)));
        if (parsed.heightCm) setHeightCm(String(parsed.heightCm).replace(/\D/g, ''));
        if (parsed.weightKg) setWeightKg(String(parsed.weightKg).replace(/\D/g, ''));
        if (parsed.shoeSize) setShoeSize(String(parsed.shoeSize).replace(/\D/g, ''));
        if (parsed.fullName || parsed.phone) setIsReturningGuest(true);
      }
      const savedTicket = localStorage.getItem(LAST_TICKET_STORAGE_KEY);
      if (savedTicket) {
        const parsedTicket = JSON.parse(savedTicket);
        if (parsedTicket?.publicToken && parsedTicket?.humanId) {
          setLastTicket(parsedTicket);
          setLookupCode(parsedTicket.humanId);
        }
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
        : ['07:00', '08:00', '09:00', '10:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

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

  const selectedDateFormatted = useMemo(() => {
    if (!selectedDate) return '-';
    const d = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return selectedDate;
    return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  }, [selectedDate]);

  const handleNextStep = () => {
    setError(null);
    if (!selectedDate || !selectedTime) {
      setFieldErrors((prev) => ({
        ...prev,
        schedule: 'Pilih tanggal dan jam sesi terlebih dahulu sebelum lanjut.',
      }));
      return;
    }
    setFieldErrors({});
    setStep(2);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const validateStep2 = (): boolean => {
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
    setFieldErrors(nextErrs);
    return Object.keys(nextErrs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (step === 1) {
      handleNextStep();
      return;
    }

    if (!validateStep2()) {
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set('requestType', requestType);
    formData.set('preferredDate', selectedDate);
    formData.set('preferredTime', selectedTime);
    formData.set('fullName', capitalizeWords(fullName.trim()));
    formData.set('phone', phone.replace(/\D/g, ''));
    formData.set('dateOfBirth', dateOfBirth);
    formData.set('domicile', capitalizeWords(domicile.trim()));
    formData.set('heightCm', heightCm.replace(/\D/g, ''));
    formData.set('weightKg', weightKg.replace(/\D/g, ''));
    formData.set('shoeSize', shoeSize.replace(/\D/g, ''));
    if (requiresGuardian) {
      formData.set('guardianName', capitalizeWords(guardianName.trim()));
      formData.set('guardianPhone', guardianPhone.replace(/\D/g, ''));
    }
    formData.set('waiverAccepted', 'true');

    try {
      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({
          fullName: capitalizeWords(fullName.trim()),
          phone: phone.replace(/\D/g, ''),
          dateOfBirth,
          domicile: capitalizeWords(domicile.trim()),
          heightCm: heightCm.replace(/\D/g, ''),
          weightKg: weightKg.replace(/\D/g, ''),
          shoeSize: shoeSize.replace(/\D/g, ''),
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

      try {
        localStorage.setItem(
          LAST_TICKET_STORAGE_KEY,
          JSON.stringify({
            publicToken: res.publicToken,
            humanId: res.requestId,
            serviceName: selectedProduct?.name || 'Casual Ride',
            preferredDate: selectedDateFormatted,
            preferredTime: selectedTime,
          })
        );
      } catch {
        // Ignore storage errors
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
      {/* ── Hero Block with Real Photography + Warm Gold/Charcoal Contrast Overlay ── */}
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <Link
              href="/login"
              aria-label="Kembali ke halaman login"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--r-md)',
                background: 'rgba(18, 18, 16, 0.72)',
                border: '1px solid rgba(233, 196, 106, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--surface)',
                textDecoration: 'none',
              }}
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </Link>
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
              : 'Masukkan nomor WhatsApp dan kode REQ-XXXX untuk membuka E-Ticket Anda.'}
          </p>

          {/* Segmented Tab Switcher (44px height) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              background: 'rgba(18, 18, 16, 0.78)',
              padding: '4px',
              borderRadius: 'var(--r-md)',
              border: '1px solid rgba(233, 196, 106, 0.25)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('book')}
              style={{
                minHeight: '44px',
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: activeTab === 'book' ? 'var(--gold)' : 'transparent',
                color: activeTab === 'book' ? 'var(--ink)' : 'rgba(255,255,255,0.82)',
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
                background: activeTab === 'check' ? 'var(--gold)' : 'transparent',
                color: activeTab === 'check' ? 'var(--ink)' : 'rgba(255,255,255,0.82)',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 1-Tap Device Shortcut if Guest booked on this phone */}
            {lastTicket && (
              <div
                className="bbs-card-elevated"
                style={{
                  padding: '18px 20px',
                  background: 'var(--ink)',
                  color: 'var(--surface)',
                  border: '1.5px solid var(--gold-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--gold)',
                      }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.5px' }}>
                      TIKET TERAKHIR DI PERANGKAT INI
                    </span>
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 800 }}>
                    {lastTicket.humanId} — {lastTicket.serviceName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                    {lastTicket.preferredDate} • {lastTicket.preferredTime} WITA
                  </div>
                </div>
                <Link
                  href={`/ride/status/${lastTicket.publicToken}`}
                  style={{
                    minHeight: '44px',
                    padding: '0 16px',
                    borderRadius: 'var(--r-sm)',
                    background: 'var(--gold)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span>Buka</span>
                  <ArrowRight size={16} strokeWidth={2} />
                </Link>
              </div>
            )}

            <form onSubmit={handleLookup} className="bbs-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ font: '800 18px/1.25 var(--font-body, sans-serif)', margin: '0 0 4px', color: 'var(--ink)' }}>
                  Cari E-Ticket Anda
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
                  Masukkan Nomor WhatsApp dan Kode Tiket (REQ-XXXX) Anda.
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 081234567890"
                  className="bbs-input tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="lookup-code" className="bbs-field-label">
                  Kode Tiket (Wajib)
                </label>
                <input
                  id="lookup-code"
                  type="text"
                  name="code"
                  required
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: REQ-4821 atau 4821"
                  className="bbs-input tabular-nums"
                />
                <div
                  style={{
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                  }}
                >
                  <Lock size={12} strokeWidth={2} color="var(--gold-accent)" />
                  <span>Wajib diisi bersama nomor WA untuk melindungi privasi tiket Anda.</span>
                </div>
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
          </div>
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

            {/* ── Single Card with Rounded Number Step Circles (1 & 2) ── */}
            <div className="bbs-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Rounded Numbered Step Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="tabular-nums"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: step === 1 ? 'var(--gold)' : 'var(--ink)',
                      color: step === 1 ? 'var(--ink)' : 'var(--gold)',
                      border: '2px solid var(--gold-accent)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 800,
                    }}
                  >
                    {step > 1 ? <Check size={16} strokeWidth={2.5} /> : '1'}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: step === 1 ? 'var(--ink)' : 'var(--muted)',
                    }}
                  >
                    Jadwal
                  </span>
                </button>

                <div
                  style={{
                    width: '36px',
                    height: '2px',
                    borderRadius: '999px',
                    background: step === 2 ? 'var(--gold-accent)' : 'var(--border)',
                  }}
                />

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className="tabular-nums"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: step === 2 ? 'var(--gold)' : 'var(--surface-subtle)',
                      color: step === 2 ? 'var(--ink)' : 'var(--muted)',
                      border: step === 2 ? '2px solid var(--gold-accent)' : '1.5px solid var(--border)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 800,
                    }}
                  >
                    2
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: step === 2 ? 'var(--ink)' : 'var(--muted)',
                    }}
                  >
                    Data Diri
                  </span>
                </div>
              </div>

              {step === 1 ? (
                <>
                  {/* STEP 1A: Pilih Jenis Layanan */}
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
                              boxSizing: 'border-box',
                              textAlign: 'left',
                              padding: '16px',
                              borderRadius: 'var(--r-md)',
                              border: isSelected ? '2px solid var(--gold-accent)' : '1.5px solid var(--border)',
                              background: isSelected ? 'var(--ink)' : 'var(--surface)',
                              color: isSelected ? 'var(--surface)' : 'var(--ink)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: isSelected ? 'var(--gold)' : 'var(--border-strong)',
                                    flexShrink: 0,
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
                                fontSize: '15px',
                                fontWeight: 800,
                                color: isSelected ? 'var(--gold)' : 'var(--ink)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              Rp {prod.price_idr.toLocaleString('id-ID')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 1B: Pilih Tanggal & Jam Preferensi (Centered, Symmetrical) */}
                  <div style={{ width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)', marginBottom: '10px' }}>
                      2. PILIH TANGGAL & JAM PREFERENSI
                    </div>

                    {/* Date Horizontal Strip */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        overflowX: 'auto',
                        padding: '2px 2px 8px',
                        width: '100%',
                        boxSizing: 'border-box',
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
                              minWidth: '64px',
                              minHeight: '72px',
                              padding: '8px 6px',
                              borderRadius: 'var(--r-md)',
                              border: isSelected ? '2px solid var(--gold-accent)' : '1.5px solid var(--border)',
                              background: isSelected ? 'var(--ink)' : 'var(--surface)',
                              color: isSelected ? 'var(--surface)' : 'var(--ink)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                              flex: '1 0 64px',
                              boxSizing: 'border-box',
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

                    {/* Centered 3-Column Time Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '10px',
                        marginTop: '10px',
                        width: '100%',
                        boxSizing: 'border-box',
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
                              width: '100%',
                              minHeight: '46px',
                              padding: '0 8px',
                              boxSizing: 'border-box',
                              borderRadius: 'var(--r-sm)',
                              border: isSelected ? '2px solid var(--gold-accent)' : '1.5px solid var(--border)',
                              background: slot.disabled
                                ? 'var(--surface-subtle)'
                                : isSelected
                                ? 'var(--ink)'
                                : 'var(--surface)',
                              color: slot.disabled
                                ? 'var(--border-strong)'
                                : isSelected
                                ? 'var(--gold)'
                                : 'var(--ink)',
                              fontSize: '14px',
                              fontWeight: 800,
                              cursor: slot.disabled ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <Clock size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
                            <span>{slot.value}</span>
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors.schedule && <div className="bbs-field-error">{fieldErrors.schedule}</div>}
                  </div>
                </>
              ) : (
                /* STEP 2: Data Rider & Ukuran Kuda */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)' }}>
                      DATA RIDER & UKURAN KUDA
                    </span>
                    {isReturningGuest && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: 'var(--gold-soft)',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--gold-ink)',
                        }}
                      >
                        <UserCheck size={13} strokeWidth={2} />
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
                      autoCapitalize="words"
                      value={fullName}
                      onChange={(e) => setFullName(capitalizeWords(e.target.value))}
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
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="Contoh: 081234567890"
                      className={`bbs-input tabular-nums ${fieldErrors.phone ? 'has-error' : ''}`}
                    />
                    {fieldErrors.phone && <div className="bbs-field-error">{fieldErrors.phone}</div>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
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
                        autoCapitalize="words"
                        value={domicile}
                        onChange={(e) => setDomicile(capitalizeWords(e.target.value))}
                        placeholder="Balikpapan"
                        className="bbs-input"
                      />
                    </div>
                  </div>

                  {/* Guardian Conditional Section for Riders < 17 */}
                  {requiresGuardian && (
                    <div
                      style={{
                        background: 'var(--gold-soft)',
                        border: '1.5px solid var(--gold-accent)',
                        borderRadius: 'var(--r-md)',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--gold-ink)' }}>
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
                          autoCapitalize="words"
                          value={guardianName}
                          onChange={(e) => setGuardianName(capitalizeWords(e.target.value))}
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
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={guardianPhone}
                          onChange={(e) => setGuardianPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="Contoh: 081234567890"
                          className={`bbs-input tabular-nums ${fieldErrors.guardianPhone ? 'has-error' : ''}`}
                        />
                        {fieldErrors.guardianPhone && (
                          <div className="bbs-field-error">{fieldErrors.guardianPhone}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Numeric Specs with Unit Suffix (Pure Numeric Keyboard) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                    <div>
                      <label htmlFor="guest-height" className="bbs-field-label">
                        Tinggi Badan
                      </label>
                      <div className="bbs-input-wrap">
                        <input
                          id="guest-height"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          name="heightCm"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, ''))}
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
                          pattern="[0-9]*"
                          name="weightKg"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value.replace(/\D/g, ''))}
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
                          pattern="[0-9]*"
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
              )}
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

            {/* ── Sticky Bottom Action Bar: Total + Price on Left, Action Button on Right ── */}
            <div className="bbs-sticky-bottom-bar">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: 'var(--muted)',
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}
                >
                  Total
                </span>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  Rp {(selectedProduct?.price_idr || 250000).toLocaleString('id-ID')}
                </div>
              </div>

              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bbs-btn-primary"
                  style={{
                    minHeight: '48px',
                    padding: '0 22px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    background: 'var(--ink)',
                    color: 'var(--gold)',
                  }}
                >
                  <span>Lanjut</span>
                  <ArrowRight size={18} strokeWidth={2} />
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    aria-label="Kembali ke pilih jadwal"
                    className="bbs-btn-secondary"
                    style={{
                      minHeight: '48px',
                      width: '48px',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <ChevronLeft size={20} strokeWidth={2} />
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bbs-btn-primary"
                    style={{
                      minHeight: '48px',
                      padding: '0 24px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      background: 'var(--ink)',
                      color: 'var(--gold)',
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                        <span>Mengirim...</span>
                      </>
                    ) : (
                      <>
                        <span>Kirim</span>
                        <ArrowRight size={18} strokeWidth={2} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
