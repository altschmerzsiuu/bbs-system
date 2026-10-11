'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, User as UserIcon, MoreHorizontal, X, Bell, Calendar, Camera, Check, Copy, UploadCloud, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { submitBooking, uploadPhotographerReceiptAction } from './actions';
import { AnimatePresence, motion } from 'framer-motion';
import { createClient } from '@/infrastructure/supabase-browser';

const DAYS_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PHOTOGRAPHER_PRICE = 200000;
const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const SlideToConfirm = ({ onConfirm, loading, resetKey }: { onConfirm: () => void, loading: boolean, resetKey?: number }) => {
  const [position, setPosition] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);

  useEffect(() => {
    if (!loading) {
      setPosition(0);
    }
  }, [loading, resetKey]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (loading) return;
    isDragging.current = true;
    startX.current = e.clientX - position;
    if (thumbRef.current) {
      thumbRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || loading) return;
    if (!sliderRef.current || !thumbRef.current) return;

    const sliderWidth = sliderRef.current.offsetWidth;
    const thumbWidth = thumbRef.current.offsetWidth;
    const maxPos = sliderWidth - thumbWidth - 8; // 4px padding each side

    let newPos = e.clientX - startX.current;
    if (newPos < 0) newPos = 0;
    if (newPos > maxPos) newPos = maxPos;

    setPosition(newPos);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current || loading) return;
    isDragging.current = false;
    if (thumbRef.current) {
      thumbRef.current.releasePointerCapture(e.pointerId);
    }

    if (!sliderRef.current || !thumbRef.current) return;
    const sliderWidth = sliderRef.current.offsetWidth;
    const thumbWidth = thumbRef.current.offsetWidth;
    const maxPos = sliderWidth - thumbWidth - 8;

    if (position >= maxPos * 0.9) {
      setPosition(maxPos);
      onConfirm();
    } else {
      setPosition(0);
    }
  };

  return (
    <div
      ref={sliderRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '64px',
        background: 'var(--ink)',
        borderRadius: '32px',
        display: 'flex',
        alignItems: 'center',
        padding: '4px',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', width: '100%', textAlign: 'center', color: 'var(--white)', fontSize: '15px', fontWeight: 600, pointerEvents: 'none', opacity: (position > 50 || loading) ? 0 : 1, transition: 'opacity 0.2s' }}>
        Slide to Confirm
      </div>
      <div
        ref={thumbRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          width: loading ? 'calc(100% - 8px)' : '56px',
          height: '56px',
          borderRadius: loading ? '28px' : '50%',
          background: 'var(--white)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: loading ? 'translateX(0)' : `translateX(${position}px)`,
          cursor: loading ? 'not-allowed' : 'grab',
          touchAction: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 2,
          transition: (isDragging.current && !loading) ? 'none' : 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          color: 'var(--ink)'
        }}
      >
        {loading ? (
          <span style={{ fontSize: '15px', fontWeight: 700, animation: 'pulse 1.5s infinite', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={18} className="spin" /> Confirming...
          </span>
        ) : (
          <ArrowRight size={24} />
        )}
      </div>
    </div>
  );
}
interface Slot {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ScheduleClient({ initialSlots, memberName = 'Rider', adminWa = '6281234567890' }: { initialSlots: Slot[], memberName?: string, adminWa?: string }) {
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const availableDates = next7Days;
  const [selectedDate, setSelectedDate] = useState<string>(availableDates[0]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [filter, setFilter] = useState<'All' | 'Morning' | 'Afternoon' | 'Evening' | 'Available'>('All');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [withPhotographer, setWithPhotographer] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [copiedRekening, setCopiedRekening] = useState(false);
  const [sliderResetKey, setSliderResetKey] = useState(0);

  useEffect(() => {
    if (!isConfirmModalOpen) {
      setWithPhotographer(false);
      setReceiptFile(null);
      setReceiptPreview(null);
      setCopiedRekening(false);
    }
  }, [isConfirmModalOpen]);

  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [bookedPassData, setBookedPassData] = useState<any>(null);
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  // Background auto-refresh for near real-time updates using Supabase Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('member_schedule_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_slots' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTime = now.toTimeString().slice(0, 8);

  let slotsForDate = initialSlots.filter(s => s.slot_date === selectedDate);
  if (selectedDate === todayStr) {
    slotsForDate = slotsForDate.filter(s => s.start_time > currentTime);
  }

  const filteredSlots = slotsForDate.filter(s => filter === 'Available' ? (s.capacity - s.booked_count > 0) : true);
  const morningSlots = filteredSlots.filter(s => parseInt(s.start_time.slice(0, 2)) < 12);
  const afternoonSlots = filteredSlots.filter(s => {
    const h = parseInt(s.start_time.slice(0, 2));
    return h >= 12 && h < 18;
  });
  const eveningSlots = filteredSlots.filter(s => parseInt(s.start_time.slice(0, 2)) >= 18);

  const handleBook = async () => {
    if (!selectedSlot) return;

    if (withPhotographer && !receiptFile && !selectedSlot.id.startsWith('mock-')) {
      toast.custom((t) => (
        <AlertToast
          title="Bukti Transfer Belum Ada"
          description="Silakan unggah foto/screenshot bukti transfer fotografer terlebih dahulu."
          variant="destructive"
          onDismiss={() => toast.dismiss(t)}
        />
      ));
      setSliderResetKey(k => k + 1);
      return;
    }

    setLoading(true);

    try {
      let receiptUrl: string | undefined;

      if (withPhotographer && receiptFile) {
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        const uploadRes = await uploadPhotographerReceiptAction(formData);
        if (!uploadRes.ok) {
          toast.custom((t) => (
            <AlertToast
              title="Gagal Upload Bukti"
              description={uploadRes.message || 'Gagal mengunggah bukti transfer.'}
              variant="destructive"
              onDismiss={() => toast.dismiss(t)}
            />
          ));
          setLoading(false);
          setSliderResetKey(k => k + 1);
          return;
        }
        receiptUrl = uploadRes.url;
      }

      let res: any;
      if (selectedSlot.id.startsWith('mock-')) {
        // Simulate network delay for mock slots
        await new Promise(resolve => setTimeout(resolve, 1500));
        res = { ok: true, bookingId: 'bbs-mock-new' };
      } else {
        res = await submitBooking(selectedSlot.id, { 
          hasPhotographer: withPhotographer,
          receiptUrl 
        });
      }

      setLoading(false);
      if (res.ok) {
        setBookedPassData({
          id: ('bookingId' in res) ? res.bookingId : 'mock-id',
          date: selectedSlot.slot_date,
          startTime: selectedSlot.start_time,
          endTime: selectedSlot.end_time,
          status: 'PENDING',
          hasPhotographer: withPhotographer
        });
        setIsConfirmModalOpen(false);
        setIsPassModalOpen(true);
        setSelectedSlot(null);
        setWithPhotographer(false);
        setReceiptFile(null);
        setReceiptPreview(null);
      } else {
        const errMsg = res.message || 'Booking failed. Please try again.';
        toast.custom((t) => (
          <AlertToast
            title="Booking Gagal"
            description={errMsg}
            variant="destructive"
            onDismiss={() => toast.dismiss(t)}
          />
        ));
        setSliderResetKey(k => k + 1);
        setIsConfirmModalOpen(false);
      }
    } catch (err: any) {
      setLoading(false);
      setSliderResetKey(k => k + 1);
      toast.custom((t) => (
        <AlertToast
          title="Booking Gagal"
          description={err.message || 'Terjadi kesalahan sistem.'}
          variant="destructive"
          onDismiss={() => toast.dismiss(t)}
        />
      ));
    }
  };

  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '16px 24px 0' }}>
        <button onClick={() => window.history.back()} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f5f7f5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <h1 style={{ font: '40px/1.1 var(--font-display)', margin: '0 0 4px 0', color: 'var(--ink)' }}>Book a Ride</h1>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>Choose your date and time</p>
      </div>


      {/* ── Month & Year ── */}
      <div style={{ padding: '0 24px 12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '1px' }}>
          {new Date(`${selectedDate}T00:00:00`).getFullYear()}
        </div>
        <h2 style={{ margin: 0, font: '28px var(--font-display)', color: 'var(--ink)' }}>
          {MONTHS_FULL[new Date(`${selectedDate}T00:00:00`).getMonth()]}
        </h2>
      </div>

      {/* ── Horizontal Calendar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 24px 20px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {availableDates.map(date => {
          const d = new Date(`${date}T00:00:00`);
          const isSelected = selectedDate === date;
          return (
            <div
              key={date}
              onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '36px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? '#b08d4b' : 'var(--muted)', marginBottom: '6px' }}>{DAYS_SHORT[d.getDay()]}</div>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#b08d4b' : 'transparent', color: isSelected ? '#fff' : 'var(--ink)', fontSize: '14px', fontWeight: 700 }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 24px 16px', overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {['All', 'Morning', 'Afternoon', 'Evening', 'Available'].map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f as any); setSelectedSlot(null); }}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: 'none',
              background: filter === f ? '#eaddbd' : '#f5f7f5',
              color: 'var(--ink)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '0 24px' }}>
        {morningSlots.length === 0 && afternoonSlots.length === 0 && (
          <div style={{ padding: '64px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <Calendar size={28} color="var(--muted)" strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', font: '24px var(--font-display)', color: 'var(--ink)' }}>No slots available</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>
              There are no available slots for this date. Please check another date.
            </p>
          </div>
        )}

        {/* ── Morning Slots ── */}
        {(filter === 'All' || filter === 'Available' || filter === 'Morning') && morningSlots.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, font: '16px var(--font-display)', color: 'var(--ink)' }}>Morning</h3>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>07:00 — 12:00</span>
            </div>
            {morningSlots.map(slot => {
              const isSelected = selectedSlot?.id === slot.id;
              const remaining = slot.capacity - slot.booked_count;
              const isFull = remaining <= 0;
              return (
                <div
                  key={slot.id}
                  onClick={() => {
                    if (!isFull) {
                      setSelectedSlot(slot);
                      setWithPhotographer(false);
                      setIsConfirmModalOpen(true);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: isFull ? '#f7f6f2' : isSelected ? '#fffdf7' : 'var(--white)',
                    border: isSelected ? '1px solid #d0b070' : '1px solid #efeee9',
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isFull ? 0.6 : 1,
                    boxShadow: isSelected ? '0 4px 12px rgba(208, 176, 112, 0.15)' : '0 2px 8px rgba(0,0,0,0.02)',
                    marginBottom: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ font: '22px var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}>{slot.start_time.slice(0, 5)}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: isFull ? 'var(--red)' : remaining === 1 ? '#b08d4b' : 'var(--green)' }}>
                      {isFull ? 'Full' : remaining === 1 ? '1 spot left' : 'Available'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>{slot.booked_count}/{slot.capacity}</div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isFull ? '#e8e8e8' : '#f5f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowRight size={16} strokeWidth={2} color={isFull ? '#fff' : 'var(--ink)'} />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── Afternoon Slots ── */}
        {(filter === 'All' || filter === 'Available' || filter === 'Afternoon') && afternoonSlots.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', marginTop: '16px' }}>
              <h3 style={{ margin: 0, font: '16px var(--font-display)', color: 'var(--ink)' }}>Afternoon</h3>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>12:00 — 18:00</span>
            </div>
            {afternoonSlots.map(slot => {
              const isSelected = selectedSlot?.id === slot.id;
              const remaining = slot.capacity - slot.booked_count;
              const isFull = remaining <= 0;
              return (
                <div
                  key={slot.id}
                  onClick={() => {
                    if (!isFull) {
                      setSelectedSlot(slot);
                      setWithPhotographer(false);
                      setIsConfirmModalOpen(true);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: isFull ? '#f7f6f2' : isSelected ? '#fffdf7' : 'var(--white)',
                    border: isSelected ? '1px solid #d0b070' : '1px solid #efeee9',
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isFull ? 0.6 : 1,
                    boxShadow: isSelected ? '0 4px 12px rgba(208, 176, 112, 0.15)' : '0 2px 8px rgba(0,0,0,0.02)',
                    marginBottom: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ font: '22px var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}>{slot.start_time.slice(0, 5)}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: isFull ? 'var(--red)' : remaining === 1 ? '#b08d4b' : 'var(--green)' }}>
                      {isFull ? 'Full' : remaining === 1 ? '1 spot left' : 'Available'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>{slot.booked_count}/{slot.capacity}</div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isFull ? '#e8e8e8' : '#f5f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowRight size={16} strokeWidth={2} color={isFull ? '#fff' : 'var(--ink)'} />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── Evening Slots ── */}
        {(filter === 'All' || filter === 'Available' || filter === 'Evening') && eveningSlots.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', marginTop: '16px' }}>
              <h3 style={{ margin: 0, font: '16px var(--font-display)', color: 'var(--ink)' }}>Evening</h3>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>18:00 - 22:00</span>
            </div>
            {eveningSlots.map(slot => {
              const isSelected = selectedSlot?.id === slot.id;
              const remaining = slot.capacity - slot.booked_count;
              const isFull = remaining <= 0;
              return (
                <div
                  key={slot.id}
                  onClick={() => {
                    if (!isFull) {
                      setSelectedSlot(slot);
                      setWithPhotographer(false);
                      setIsConfirmModalOpen(true);
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: isFull ? '#f7f6f2' : isSelected ? '#fffdf7' : 'var(--white)',
                    border: isSelected ? '1px solid #d0b070' : '1px solid #efeee9',
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isFull ? 0.6 : 1,
                    boxShadow: isSelected ? '0 4px 12px rgba(208, 176, 112, 0.15)' : '0 2px 8px rgba(0,0,0,0.02)',
                    marginBottom: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ font: '22px var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}>{slot.start_time.slice(0, 5)}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: isFull ? 'var(--red)' : remaining === 1 ? '#b08d4b' : 'var(--green)' }}>
                      {isFull ? 'Full' : remaining === 1 ? '1 spot left' : 'Available'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>{slot.booked_count}/{slot.capacity}</div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isFull ? '#e8e8e8' : '#f5f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ArrowRight size={16} strokeWidth={2} color={isFull ? '#fff' : 'var(--ink)'} />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>



      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        {isConfirmModalOpen && selectedSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsConfirmModalOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.05}
              onDragEnd={(e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setIsConfirmModalOpen(false);
                }
              }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              style={{
                background: '#fff',
                borderRadius: '32px 32px 0 0',
                padding: '16px 24px 40px',
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
            >
              {/* Drag Handle Indicator */}
              <div style={{ width: '40px', height: '4px', background: '#e0e0e0', borderRadius: '2px', margin: '0 auto 24px' }} />

              <h2 style={{ font: '28px var(--font-display)', margin: '0 0 8px 0', color: 'var(--ink)', textAlign: 'center' }}>Confirm Booking</h2>
              <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 24px', textAlign: 'center' }}>
                Are you sure you want to book this session?
              </p>

              <div style={{ background: '#f9f6ef', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid #efeade' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Rider</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{memberName.split(' ')[0]}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Date</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{DAYS_FULL[new Date(`${selectedSlot.slot_date}T00:00:00`).getDay()]}, {new Date(`${selectedSlot.slot_date}T00:00:00`).getDate()} {MONTHS_SHORT[new Date(`${selectedSlot.slot_date}T00:00:00`).getMonth()]}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Time</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>{selectedSlot.start_time.slice(0, 5)} — {selectedSlot.end_time.slice(0, 5)} WITA</span>
                </div>

                {withPhotographer && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2dcd0' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Fotografer</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#4f6b49' }}>+ {formatRp(PHOTOGRAPHER_PRICE)}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={withPhotographer}
                onClick={() => {
                  setWithPhotographer(v => {
                    const next = !v;
                    if (!next) {
                      setReceiptFile(null);
                      setReceiptPreview(null);
                    }
                    return next;
                  });
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left',
                  padding: '14px 16px', marginBottom: withPhotographer ? '14px' : '20px', borderRadius: '16px', cursor: 'pointer',
                  background: withPhotographer ? '#f1f6ef' : '#fff',
                  border: `1.5px solid ${withPhotographer ? '#7c9a75' : '#e6e1d4'}`,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: withPhotographer ? '#7c9a75' : '#f5f7f5', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Camera size={20} color={withPhotographer ? '#fff' : 'var(--ink)'} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>Tambah Fotografer</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                    {formatRp(PHOTOGRAPHER_PRICE)}/Sesi · transfer bank & upload bukti
                  </div>
                </div>
                <div style={{ width: '44px', height: '26px', borderRadius: '13px', background: withPhotographer ? '#7c9a75' : '#d9d5c8', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: '3px', left: withPhotographer ? '21px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
              </button>

              {/* Transfer Details & Proof Upload when photographer is enabled */}
              {withPhotographer && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  {/* Rekening Info Card */}
                  <div style={{
                    background: '#FAF8F5',
                    border: '1px solid #ECE7DC',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '0.4px' }}>
                        TRANSFER BANK BCA
                      </span>
                      <span style={{ fontSize: '10px', background: 'rgba(216, 188, 128, 0.22)', color: '#8C6E2D', padding: '2px 8px', borderRadius: '100px', fontWeight: 800 }}>
                        OFFICIAL BBS
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#FFFFFF',
                      border: '1px solid #ECE7DC',
                      padding: '10px 14px',
                      borderRadius: '12px'
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Nomor Rekening</div>
                        <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace', color: 'var(--ink)' }}>
                          1490011867027
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('1490011867027');
                          setCopiedRekening(true);
                          setTimeout(() => setCopiedRekening(false), 2000);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: copiedRekening ? '#15803D' : 'var(--ink)',
                          color: '#FFF',
                          border: 'none',
                          height: '34px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {copiedRekening ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedRekening ? 'Tersalin' : 'Salin'}</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <span style={{ color: 'var(--muted)' }}>A/N <b style={{ color: 'var(--ink)', fontWeight: 700 }}>PT BERKAH BERKUDA SEJAHTERA</b></span>
                      <span style={{ fontWeight: 800, color: '#8C6E2D', fontSize: '13px' }}>Rp 200.000</span>
                    </div>
                  </div>

                  {/* Upload Dropzone */}
                  <label style={{
                    display: 'block',
                    background: '#FAF8F5',
                    border: receiptFile ? '1.5px solid #7c9a75' : '1.5px dashed #D5CEBE',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease, background 0.2s ease',
                    position: 'relative'
                  }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 5 * 1024 * 1024) {
                          toast.error('Ukuran foto maksimal 5MB');
                          return;
                        }
                        setReceiptFile(f);
                        const url = URL.createObjectURL(f);
                        setReceiptPreview(url);
                      }}
                      style={{ display: 'none' }}
                    />

                    {!receiptFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#F0EBE1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <UploadCloud size={18} color="var(--ink)" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                            Upload Bukti Transfer
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                            Ketuk untuk unggah screenshot transfer (Maks. 5MB)
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          {receiptPreview && (
                            <div style={{ width: '38px', height: '38px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ECE7DC', flexShrink: 0 }}>
                              <img src={receiptPreview} alt="Receipt preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '180px' }}>
                              {receiptFile.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#15803D', fontWeight: 600, marginTop: '2px' }}>
                              {(receiptFile.size / 1024).toFixed(0)} KB · Bukti Siap
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setReceiptFile(null);
                            setReceiptPreview(null);
                          }}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            background: '#FEE2E2',
                            border: 'none',
                            color: '#DC2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </label>
                </div>
              )}

              <SlideToConfirm loading={loading} onConfirm={handleBook} resetKey={sliderResetKey} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Riding Pass Modal ── */}
      {isPassModalOpen && bookedPassData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: 'var(--white)', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
            <button onClick={() => router.push('/home')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--paper)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}>
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

          {/* Ticket Body */}
          <div style={{ padding: '0 24px', flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: '32px' }}>
            <div className="ticket-card" style={{ background: '#f9f6ef', borderRadius: '16px', position: 'relative', flex: 1, padding: '24px', overflow: 'hidden', border: '1px solid #efeade' }}>
              <div style={{ position: 'absolute', right: '-30%', top: '10%', height: '110%', opacity: 0.15, pointerEvents: 'none' }}>
                <img src="/images/horse-7.png" style={{ height: '100%', objectFit: 'contain' }} alt="" />
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                  <div>
                    <h3 style={{ font: '24px var(--font-display)', margin: 0, color: 'var(--ink)' }}>BBS</h3>
                    <div style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginTop: '2px' }}>Borneo Berkuda Stable</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ background: '#7c9a75', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '6px 12px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                      {bookedPassData.status}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase' }}>PASS #{bookedPassData.id.substring(0, 8).toUpperCase()}</div>
                  </div>
                </div>

                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {DAYS_FULL[new Date(`${bookedPassData.date}T00:00:00`).getDay()]}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', marginBottom: '24px', borderBottom: '1px solid #e2dcd0', paddingBottom: '4px', display: 'inline-block' }}>
                  {new Date(`${bookedPassData.date}T00:00:00`).getDate()} {MONTHS_FULL[new Date(`${bookedPassData.date}T00:00:00`).getMonth()].toUpperCase()} {new Date(`${bookedPassData.date}T00:00:00`).getFullYear()}
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 600, color: '#5f5542', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ebd2a4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MapPin size={10} color="#5a4214" /></div>
                    Jl. Soekarno Hatta Km. 10
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ebd2a4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={10} color="#5a4214" /></div>
                    {memberName.split(' ')[0]}
                  </div>
                </div>

                <div style={{ font: '48px/1 var(--font-display)', color: 'var(--ink)', marginBottom: '40px' }}>
                  {bookedPassData.startTime.slice(0, 5)} — {bookedPassData.endTime.slice(0, 5)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Session Time</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>{bookedPassData.startTime.slice(0, 5)} — {bookedPassData.endTime.slice(0, 5)} WITA</div>
                  </div>
                  {bookedPassData.hasPhotographer && (
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Layanan tambahan</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: '#4f6b49' }}>
                        <Camera size={14} strokeWidth={2} /> Fotografer · {formatRp(PHOTOGRAPHER_PRICE)}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '2px dashed #e2dcd0', margin: '32px 0 24px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-32px', top: '-10px', width: '20px', height: '20px', background: 'var(--white)', borderRadius: '50%' }}></div>
                  <div style={{ position: 'absolute', right: '-32px', top: '-10px', width: '20px', height: '20px', background: 'var(--white)', borderRadius: '50%' }}></div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', height: '40px', background: 'repeating-linear-gradient(90deg, var(--ink) 0, var(--ink) 2px, transparent 2px, transparent 4px, var(--ink) 4px, var(--ink) 8px, transparent 8px, transparent 12px, var(--ink) 12px, var(--ink) 14px, transparent 14px, transparent 18px)', opacity: 0.8, marginBottom: '8px' }}></div>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', color: 'var(--ink)', textTransform: 'uppercase' }}>Good Horses Brighter People</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                onClick={() => router.push('/home')}
                style={{
                  width: '100%',
                  height: '56px',
                  fontSize: '15px',
                  fontWeight: 600,
                  borderRadius: '100px',
                  background: 'var(--ink)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                }}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
