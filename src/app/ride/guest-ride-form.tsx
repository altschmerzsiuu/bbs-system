'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Info,
  ShieldCheck,
  Ticket,
  UserCheck,
  Search,
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
  adminWa,
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
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [waiverAccepted, setWaiverAccepted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Ticket lookup state
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  const riderAge = useMemo(() => computeAgeFromDob(dateOfBirth), [dateOfBirth]);
  const requiresGuardian = riderAge !== null && riderAge >= 0 && riderAge < 17;

  const availableDates = useMemo(() => {
    const unique = Array.from(new Set((slots || []).map((s) => s.slot_date))).sort();
    if (unique.length > 0) return unique;
    // Fallback 7 days if slots table is empty
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!selectedDate || !selectedTime) {
      setError('Silakan pilih tanggal dan jam preferensi berkuda terlebih dahulu.');
      return;
    }

    if (!waiverAccepted) {
      setError('Anda wajib menyetujui ketentuan keselamatan berkuda (waiver).');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set('requestType', requestType);
    formData.set('preferredDate', selectedDate);
    formData.set('preferredTime', selectedTime);
    formData.set('waiverAccepted', waiverAccepted ? 'true' : 'false');

    try {
      const res = await submitGuestRequest(formData);
      if (!res.ok) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      toast.custom((t) => (
        <AlertToast
          title="Permohonan Terkirim!"
          description={`Kode: ${res.requestId}. Mengarahkan ke halaman status & E-Ticket...`}
          onDismiss={() => toast.dismiss(t)}
        />
      ));
      router.push(`/ride/status/${res.publicToken}`);
    } catch {
      setError('Terjadi kesalahan jaringan. Silakan coba lagi.');
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
      setLookupError('Gagal memeriksa status tiket. Silakan coba lagi.');
      setIsLookingUp(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '15px 16px',
    borderRadius: '14px',
    border: '1px solid #e0dfda',
    background: 'var(--white)',
    fontSize: '15px',
    fontFamily: 'var(--font-sans)',
    color: 'var(--ink)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <div
      suppressHydrationWarning
      style={{
        background: 'var(--paper)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '520px',
        margin: '0 auto',
      }}
    >
      {/* Sticky Header */}
      <div
        style={{
          padding: '20px 20px 14px',
          position: 'sticky',
          top: 0,
          background: 'var(--paper)',
          zIndex: 20,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <Link
            href="/login"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'var(--white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e0dfda',
              color: 'var(--ink)',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '1.4px',
                textTransform: 'uppercase',
                color: 'var(--gold)',
              }}
            >
              Borneo Berkuda Stable
            </div>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                color: 'var(--ink)',
                margin: 0,
              }}
            >
              Reservasi Tamu (Non-Member)
            </h1>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            background: '#EFECE4',
            padding: '4px',
            borderRadius: '14px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('book')}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'book' ? 'var(--ink)' : 'transparent',
              color: activeTab === 'book' ? 'var(--white)' : 'var(--ink)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Calendar size={15} />
            <span>Pesan Sesi Baru</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('check')}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'check' ? 'var(--ink)' : 'transparent',
              color: activeTab === 'check' ? 'var(--white)' : 'var(--ink)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Ticket size={15} />
            <span>Cek Tiket Saya</span>
          </button>
        </div>
      </div>

      {activeTab === 'check' ? (
        <div style={{ padding: '24px 20px 60px' }}>
          <div
            style={{
              background: 'var(--white)',
              borderRadius: '20px',
              padding: '24px 20px',
              border: '1px solid #e6e2d8',
              boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: '#fbf8f1',
                border: '1px solid #f0e4c8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold)',
                marginBottom: '16px',
              }}
            >
              <Ticket size={24} />
            </div>
            <h2 style={{ font: '24px var(--font-display)', margin: '0 0 8px', color: 'var(--ink)' }}>
              Cek Status & E-Ticket
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Masukkan nomor WhatsApp yang Anda gunakan saat mengisi form reservasi untuk melihat status konfirmasi dan E-Ticket Anda.
            </p>

            <form onSubmit={handleLookup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Nomor WhatsApp</label>
                <input
                  name="phone"
                  type="tel"
                  required
                  placeholder="Contoh: 08123456789"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Kode Request (Opsional)</label>
                <input
                  name="requestCode"
                  type="text"
                  placeholder="Contoh: BBS-REQ-..."
                  style={inputStyle}
                />
              </div>

              {lookupError && (
                <div
                  style={{
                    background: '#fce8e8',
                    color: 'var(--red)',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <span>{lookupError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLookingUp}
                style={{
                  width: '100%',
                  height: '52px',
                  background: 'var(--ink)',
                  color: 'var(--white)',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: isLookingUp ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Search size={18} />
                <span>{isLookingUp ? 'Mencari Tiket...' : 'Lihat Status & E-Ticket'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ padding: '20px 20px 48px', display: 'flex', flexDirection: 'column', gap: '28px' }}
        >
          {/* Honeypot field for bots (hidden from humans) */}
          <div
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
          >
            <label htmlFor="website_hp">Website</label>
            <input id="website_hp" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {/* 1. Pilih Layanan Berkuda */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--ink)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                1
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                Pilih Jenis Sesi
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {products.map((prod) => {
                const isSelected = requestType === prod.code;
                return (
                  <div
                    key={prod.code}
                    onClick={() => setRequestType(prod.code)}
                    style={{
                      padding: '16px',
                      borderRadius: '18px',
                      border: `2px solid ${isSelected ? 'var(--gold)' : '#e0dfda'}`,
                      background: isSelected ? '#fbf8f1' : 'var(--white)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '16px' }}>
                          {prod.name}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.4 }}>
                          {prod.description}
                        </div>
                      </div>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? 'var(--gold)' : '#d0cfca'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              width: '11px',
                              height: '11px',
                              borderRadius: '50%',
                              background: 'var(--gold)',
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {prod.price_idr > 0 && (
                      <div
                        style={{
                          marginTop: '12px',
                          paddingTop: '10px',
                          borderTop: '1px dashed #e5dfd2',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                          Tarif Sesi
                        </span>
                        <span
                          style={{
                            fontSize: '16px',
                            fontWeight: 800,
                            color: 'var(--ink)',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          Rp {prod.price_idr.toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Pilih Tanggal & Jam Preferensi */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--ink)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                2
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                Pilih Jadwal Preferensi
              </h2>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: '0 0 14px 36px', lineHeight: 1.4 }}>
              Pilih tanggal dan jam yang Anda inginkan. Admin BBS akan mengonfirmasi ketersediaan kuda & instruktur.
            </p>

            {/* Date Selector Horizontal Scroll */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Tanggal Berkuda</label>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '6px',
                  scrollbarWidth: 'none',
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
                        padding: '10px 8px',
                        borderRadius: '14px',
                        border: isSelected ? '2px solid var(--ink)' : '1px solid #e0dfda',
                        background: isSelected ? 'var(--ink)' : 'var(--white)',
                        color: isSelected ? 'var(--white)' : 'var(--ink)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: '11px', opacity: isSelected ? 0.85 : 0.6, fontWeight: 600 }}>
                        {DAYS_SHORT[d.getDay()]}
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: 800 }}>{d.getDate()}</span>
                      <span style={{ fontSize: '11px', opacity: isSelected ? 0.85 : 0.6, fontWeight: 600 }}>
                        {MONTHS_SHORT[d.getMonth()]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Grid */}
            <div>
              <label style={labelStyle}>Jam Sesi</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {timeOptions.map((slot) => {
                  const isSelected = selectedTime === slot.value;
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      disabled={slot.disabled}
                      onClick={() => setSelectedTime(slot.value)}
                      style={{
                        padding: '12px 6px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid var(--gold)' : '1px solid #e0dfda',
                        background: slot.disabled
                          ? '#f2f0ea'
                          : isSelected
                          ? '#fbf8f1'
                          : 'var(--white)',
                        color: slot.disabled ? '#b5b2a8' : 'var(--ink)',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: slot.disabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={13} color={isSelected ? 'var(--gold)' : 'currentColor'} />
                      <span>{slot.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 3. Informasi Data Diri */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--ink)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                3
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                Data Diri Rider
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Nama Lengkap Rider</label>
                <input
                  name="fullName"
                  type="text"
                  required
                  style={inputStyle}
                  placeholder="Nama lengkap sesuai identitas"
                />
              </div>

              <div>
                <label style={labelStyle}>Nomor WhatsApp Aktif</label>
                <input
                  name="phone"
                  type="tel"
                  required
                  style={inputStyle}
                  placeholder="Contoh: 08123456789"
                />
                <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--muted)', marginTop: '4px' }}>
                  Konfirmasi jadwal & link E-Ticket akan dikirimkan ke nomor ini.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Tanggal Lahir</label>
                  <input
                    name="dateOfBirth"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Kota Domisili</label>
                  <input
                    name="domicile"
                    type="text"
                    required
                    style={inputStyle}
                    placeholder="Contoh: Balikpapan"
                    onChange={(e) => {
                      const start = e.target.selectionStart;
                      const end = e.target.selectionEnd;
                      e.target.value = e.target.value
                        .split(' ')
                        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
                        .join(' ');
                      e.target.setSelectionRange(start, end);
                    }}
                  />
                </div>
              </div>

              {/* Conditional Guardian Box for Riders Under 17 */}
              {requiresGuardian && (
                <div
                  style={{
                    background: '#FDFBF7',
                    border: '1.5px solid var(--gold)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8C6E2D' }}>
                    <UserCheck size={18} />
                    <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Data Orang Tua / Wali (Usia Rider: {riderAge} Tahun)
                    </span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                    Untuk rider berusia di bawah 17 tahun, mohon lengkapi nama dan nomor WhatsApp orang tua atau wali pendamping.
                  </p>
                  <div>
                    <label style={labelStyle}>Nama Orang Tua / Wali</label>
                    <input
                      name="guardianName"
                      type="text"
                      required={requiresGuardian}
                      style={inputStyle}
                      placeholder="Nama lengkap orang tua / wali"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Nomor WhatsApp Orang Tua / Wali</label>
                    <input
                      name="guardianPhone"
                      type="tel"
                      required={requiresGuardian}
                      style={inputStyle}
                      placeholder="Contoh: 0812..."
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 4. Profil Fisik (Untuk Pemilihan Kuda & Perlengkapan) */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--ink)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                }}
              >
                4
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                Profil Berkuda
              </h2>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: '0 0 14px 36px', lineHeight: 1.4 }}>
              Digunakan oleh tim Groomer BBS untuk menyiapkan kuda dan sepatu boots/helm yang sesuai ukuran Anda.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Tinggi (cm)</label>
                <input
                  name="heightCm"
                  type="number"
                  min={50}
                  max={250}
                  required
                  style={inputStyle}
                  placeholder="165"
                />
              </div>
              <div>
                <label style={labelStyle}>Berat (kg)</label>
                <input
                  name="weightKg"
                  type="number"
                  min={15}
                  max={200}
                  required
                  style={inputStyle}
                  placeholder="58"
                />
              </div>
              <div>
                <label style={labelStyle}>Sepatu (EUR)</label>
                <input
                  name="shoeSize"
                  type="number"
                  min={20}
                  max={50}
                  required
                  style={inputStyle}
                  placeholder="40"
                />
              </div>
            </div>
          </section>

          {/* 5. Waiver Keselamatan */}
          <section>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                background: 'var(--white)',
                padding: '16px',
                borderRadius: '16px',
                border: waiverAccepted ? '1.5px solid var(--gold)' : '1px solid #e0dfda',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={waiverAccepted}
                onChange={(e) => setWaiverAccepted(e.target.checked)}
                style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: 'var(--ink)', flexShrink: 0 }}
              />
              <div style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <ShieldCheck size={16} color="var(--gold)" />
                  <span>Persetujuan Keselamatan Berkuda (Riding Waiver)</span>
                </div>
                <span style={{ color: 'var(--muted)' }}>
                  Saya menyatakan data fisik di atas benar dan bersedia mengikuti seluruh instruksi keselamatan dari pelatih/groomer Borneo Berkuda Stable selama berada di area kandang & arena.
                </span>
              </div>
            </label>
          </section>

          {error && (
            <div
              style={{
                background: '#fce8e8',
                color: 'var(--red)',
                padding: '14px 16px',
                borderRadius: '14px',
                fontSize: '13.5px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontWeight: 500,
              }}
            >
              <Info size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Summary Footer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                height: '56px',
                background: 'var(--ink)',
                color: 'var(--white)',
                border: 'none',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
              }}
            >
              <span>{isSubmitting ? 'Mengirim Reservasi...' : 'Kirim Reservasi & Dapatkan Tiket'}</span>
              {!isSubmitting && <ArrowRight size={20} />}
            </button>

            <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
              Ingin berlatih rutin dengan harga lebih hemat?{' '}
              <Link href="/login" style={{ color: 'var(--ink)', fontWeight: 700, textDecoration: 'underline' }}>
                Masuk / Daftar Member
              </Link>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
