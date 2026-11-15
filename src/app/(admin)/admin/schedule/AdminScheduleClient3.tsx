'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, Check, Download, MoreHorizontal, Share2, X } from 'lucide-react';
import SessionSlot from '@/components/admin/SessionSlot';
import { getScheduleRecapAction, multiToggleSlotAction } from './actions';
import type { AdminScheduleSlot } from '@/modules/bookings/booking-types';
import { createClient } from '@/infrastructure/supabase-browser';
import { renderDailySchedule, type DailySlot } from '@/lib/export/renderDailySchedule';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getDaysInMonth(year: number, month: number) {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
}

function TimelineSlot({
    time,
    slot,
    isSelected,
    onSelectToggle,
    readOnly,
}: {
    time: string;
    slot: AdminScheduleSlot | undefined;
    isSelected?: boolean;
    onSelectToggle?: () => void;
    readOnly?: boolean;
}) {
    const participantCount = slot?.booking?.participants.length ?? 0;
    const isClosed = Boolean(slot && !slot.isOpen);
    const isBooked = participantCount > 0;
    const markerColor = isClosed ? '#B9645D' : isBooked ? '#181817' : '#E3E3E1';

    return (
        <div style={{ display: 'flex', minHeight: isBooked ? '148px' : '82px', marginBottom: '8px' }}>
            <div style={{ width: '62px', flexShrink: 0, textAlign: 'right', paddingRight: '13px', paddingTop: '17px' }}>
                <div style={{ fontSize: '19px', lineHeight: 1, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em' }}>{time}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', marginTop: '6px' }}>
                    {slot ? `${participantCount}/${slot.capacity}` : '0/2'}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${markerColor}`, backgroundColor: isBooked || isClosed ? markerColor : '#F9F9F8', boxShadow: '0 0 0 4px #F9F9F8', flexShrink: 0, marginTop: '19px', zIndex: 1 }} />
                <div style={{ width: '2px', flexGrow: 1, backgroundColor: 'rgba(24,24,23,0.08)', margin: '4px 0' }} />
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingLeft: '17px', paddingBottom: '14px' }}>
                {slot?.slotExists ? (
                    <SessionSlot slot={slot} isSelected={isSelected} onSelectToggle={onSelectToggle} readOnly={readOnly} />
                ) : (
                    <div
                        onClick={readOnly ? undefined : onSelectToggle}
                        style={{
                            background: '#FFF', border: `2px solid ${isSelected ? 'var(--ink)' : 'rgba(24,24,23,0.10)'}`, borderRadius: '18px', padding: '13px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: readOnly ? 'default' : 'pointer', boxShadow: isSelected ? '0 9px 24px rgba(24,24,23,0.10)' : '0 5px 18px rgba(24,24,23,0.035)', opacity: readOnly ? 0.58 : 1, filter: readOnly ? 'grayscale(0.75)' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>Tersedia</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>2 Slot Tersedia</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ background: '#F5EEDD', color: '#A37834', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 600 }}>Kosong</span>
                        </div>
                        {!readOnly && <div style={{ width: '24px', height: '24px', borderRadius: '6px', border: isSelected ? 'none' : '2px solid #EAEAEA', background: isSelected ? 'var(--ink)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSelected && <Check size={14} color="#FFF" strokeWidth={3} />}
                        </div>}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AdminScheduleClient3({ initialSlots, initialDate, monthSummary = {} }: { initialSlots: AdminScheduleSlot[]; initialDate: string; monthSummary?: Record<string, number> }) {
    const router = useRouter();
    const [slots, setSlots] = useState(initialSlots);
    const [selectedDate, setSelectedDate] = useState(new Date(initialDate));

    // Auto-update slots when initialDate prop changes (Next.js navigation)
    useEffect(() => {
        setSlots(initialSlots);
        setSelectedDate(new Date(initialDate));
    }, [initialSlots, initialDate]);

    // Background auto-refresh for near real-time updates using Supabase Realtime
    useEffect(() => {
        const supabase = createClient();
        const channel = supabase.channel('admin_schedule_changes')
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

    const [activeChip, setActiveChip] = useState('Semua');
    const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [closeReason, setCloseReason] = useState('Perawatan kuda');
    const [closeReasonCustom, setCloseReasonCustom] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

    const toggleSelection = (time: string) => {
        const targetSlot = slots.find(slot => slot.startTime === time);
        const targetIsClosed = targetSlot ? !targetSlot.isOpen : false;

        setSelectedSlots(prev => {
            if (prev.includes(time)) return prev.filter(selectedTime => selectedTime !== time);

            const firstSelected = slots.find(slot => slot.startTime === prev[0]);
            const selectionIsClosed = firstSelected ? !firstSelected.isOpen : false;

            // A single action must always describe the whole selection.
            return prev.length > 0 && selectionIsClosed !== targetIsClosed ? [time] : [...prev, time];
        });
    };

    const handleSelectDate = (date: Date) => {
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        router.push(`/admin/schedule?date=${dateString}`);
    };

    const handlePrevMonth = () => {
        const d = new Date(selectedDate);
        d.setDate(1);
        d.setMonth(d.getMonth() - 1);
        handleSelectDate(d);
    };

    const handleNextMonth = () => {
        const d = new Date(selectedDate);
        d.setDate(1);
        d.setMonth(d.getMonth() + 1);
        handleSelectDate(d);
    };

    const handleShareSchedule = async () => {
        const dateLabel = new Intl.DateTimeFormat('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        }).format(selectedDate);

        const recapSlots = slots
            .filter(s => s.slotExists)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        // Build structured text summary
        const activeSlots = recapSlots.filter(s => s.isOpen && (s.booking?.participants?.length ?? 0) > 0);
        const totalRiders = activeSlots.reduce((sum, s) => sum + (s.booking?.participants?.length ?? 0), 0);

        const morningSlots = recapSlots.filter(s => parseInt(s.startTime.slice(0, 2), 10) < 12);
        const afternoonSlots = recapSlots.filter(s => parseInt(s.startTime.slice(0, 2), 10) >= 12);

        const formatSlot = (s: typeof recapSlots[0]) => {
            const time = `${s.startTime.slice(0, 5)} - ${s.endTime.slice(0, 5)}`;
            if (!s.isOpen) {
                return `• ${time}: *Ditutup* (${s.closedReason || 'Maintenance'})`;
            }
            const parts = (s.booking?.participants ?? []).map(p => {
                let name = p.name;
                if (p.horseName) name += ` (${p.horseName})`;
                return name;
            });
            if (parts.length === 0) {
                return `• ${time}: Kosong (${s.capacity ?? 2} slot)`;
            }
            return `• ${time}: ${parts.join(', ')}`;
        };

        const text = `Sesi Hari Ini - ${dateLabel}`;

        const dailySlots: DailySlot[] = recapSlots.map(s => ({
            startTime: s.startTime,
            endTime: s.endTime,
            capacity: s.capacity ?? 2,
            isOpen: s.isOpen,
            closedReason: s.closedReason ?? null,
            participants: (s.booking?.participants ?? []).map(p => ({
                name: p.name,
                horseName: p.horseName ?? null,
                hasPhotographer: Boolean(p.hasPhotographer ?? s.booking?.notes?.includes('Fotografer')),
            })),
        }));

        if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;

        const generatedAt = new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Makassar',
        }).format(new Date()).replace('.', ':');

        const canvas = renderDailySchedule({ dateLabel, slots: dailySlots, generatedAt });

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) return;
        const file = new File([blob], `rekap-jadwal-${initialDate}.png`, { type: 'image/png' });
        const shareData = { title: `Sesi Hari Ini - ${dateLabel}`, text, files: [file] };

        const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        // Jika di HP (Mobile), gunakan Web Share API bawaan HP yang bersih tanpa path
        if (isMobile && navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
            try {
                await navigator.share(shareData);
                return;
            } catch (error) {
                if ((error as DOMException).name === 'AbortError') return;
            }
        }

        // Jika di Desktop (Laptop/Mac), Web Share Chrome memiliki bug yang menempelkan path disk lokal (/Users/...).
        // Solusinya: Salin gambar ke clipboard & unduh file agar bisa langsung di-Paste (Cmd+V) di WhatsApp Web tanpa path.
        let copied = false;
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                copied = true;
            } catch {
                copied = false;
            }
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); 
        link.href = url; 
        link.download = file.name; 
        link.click(); 
        URL.revokeObjectURL(url);

        if (copied) {
            toast.custom((t) => (
                <AlertToast 
                    title="Gambar Disalin ke Clipboard!" 
                    description="Buka chat WhatsApp dan tekan Cmd+V (Paste) untuk mengirim gambar bersih tanpa path." 
                    onDismiss={() => toast.dismiss(t)} 
                />
            ));
        } else {
            toast.custom((t) => (
                <AlertToast 
                    title="Gambar Berhasil Diunduh" 
                    description="Gambar siap dikirim ke WhatsApp." 
                    onDismiss={() => toast.dismiss(t)} 
                />
            ));
        }
    };

    const handleDownloadRecap = async (period: 'week' | 'month') => {
        const start = new Date(selectedDate); const end = new Date(selectedDate);
        if (period === 'week') { start.setDate(start.getDate() - start.getDay()); end.setDate(end.getDate() + (6 - end.getDay())); }
        else { start.setDate(1); end.setMonth(end.getMonth() + 1, 0); }
        const format = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
        const result = await getScheduleRecapAction(format(start), format(end));
        if (!result.ok) {
            toast.custom((t) => <AlertToast title="Gagal" description={result.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
            return;
        }
        const rows = result.rows ?? [];
        const csv = ['Tanggal,Jam,Rider,Kapasitas,Status,Alasan', ...rows.map(row => [row.date, `${row.startTime}-${row.endTime}`, row.riderCount, row.capacity, row.isOpen ? (row.riderCount >= row.capacity ? 'Penuh' : 'Terbuka') : 'Ditutup', `"${row.closedReason.replaceAll('"', '""')}"`].join(','))].join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `rekap-${period}-${format(start)}.csv`; link.click(); URL.revokeObjectURL(url);
        toast.custom((t) => <AlertToast title="Berhasil" description="Rekap berhasil diunduh." onDismiss={() => toast.dismiss(t)} />);
    };

    const daysInMonth = getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollContainerRef.current) {
            const selectedElement = scrollContainerRef.current.querySelector('.selected-day') as HTMLElement;
            if (selectedElement) {
                const containerWidth = scrollContainerRef.current.offsetWidth;
                scrollContainerRef.current.scrollTo({
                    left: selectedElement.offsetLeft - (containerWidth / 2) + (selectedElement.offsetWidth / 2),
                    behavior: 'smooth'
                });
            }
        }
    }, [selectedDate]);

    const handleAction = async (isOpen: boolean) => {
        if (selectedSlots.length === 0) return;
        setIsSaving(true);

        let reason = closeReason;
        if (reason === 'Lainnya') reason = closeReasonCustom || 'Ditutup oleh Admin';

        const payload = selectedSlots.map(time => {
            const existing = slots.find(s => s.startTime === time);
            return {
                date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
                startTime: time,
                endTime: existing?.endTime ?? `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:00`,
                capacity: existing?.capacity ?? 2,
                closedReason: isOpen ? null : reason,
            };
        });

        const res = await multiToggleSlotAction(payload, isOpen);
        setIsSaving(false);
        if (res.ok) {
            toast.custom((t) => <AlertToast title="Berhasil" description={isOpen ? 'Slot berhasil dibuka' : 'Slot berhasil ditutup'} onDismiss={() => toast.dismiss(t)} />);
            setSelectedSlots([]);
            setCloseModalOpen(false);
            router.refresh();
        } else {
            toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        }
    };

    const totalCapacity = slots.reduce((acc, curr) => acc + (curr.capacity ?? 2), 0) || 1;
    const usedCapacity = slots.reduce((acc, curr) => acc + (curr.booking?.participants.length ?? 0), 0);
    const capacityPercent = Math.min(100, Math.round((usedCapacity / totalCapacity) * 100));

    const activeSessions = slots.filter(s => s.booking && s.booking.participants.length > 0).length;
    const emptySlotCount = slots.filter(s => s.isOpen && (!s.booking || s.booking.participants.length === 0)).length;
    const closedCount = slots.filter(s => !s.isOpen).length;
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const currentKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const isHistory = currentKey < todayKey;
    const selectedSlotIsClosed = selectedSlots.length > 0 && (() => {
        const selectedSlot = slots.find(slot => slot.startTime === selectedSlots[0]);
        return Boolean(selectedSlot && !selectedSlot.isOpen);
    })();

    const morningSlots = slots.filter(s => parseInt(s.startTime.split(':')[0]) < 12);
    const afternoonSlots = slots.filter(s => parseInt(s.startTime.split(':')[0]) >= 12 && parseInt(s.startTime.split(':')[0]) < 18);
    const eveningSlots = slots.filter(s => parseInt(s.startTime.split(':')[0]) >= 18);

    let filteredSlots = slots;
    if (activeChip === 'Slot kosong') filteredSlots = slots.filter(s => s.isOpen && (!s.booking || s.booking.participants.length === 0));
    else if (activeChip === 'Pagi') filteredSlots = morningSlots;
    else if (activeChip === 'Sore') filteredSlots = afternoonSlots;
    else if (activeChip === 'Malam') filteredSlots = eveningSlots;

    return (
        <div style={{ paddingBottom: '120px' }}>
            <Toaster position="top-center" />

            {/* TOP NAV */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 6px' }}>
                <Link href="/admin" aria-label="Kembali ke dashboard" style={{ width: '38px', height: '38px', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', textDecoration: 'none' }}>
                    <ChevronLeft size={22} strokeWidth={2.6} />
                </Link>
                <h1 style={{ fontSize: '24px', lineHeight: 1, fontFamily: 'var(--font-display)', letterSpacing: '-0.035em', fontWeight: 700 }}>Jadwal Sesi</h1>
                <div style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={() => setIsMenuOpen(prev => !prev)}
                        aria-label="Opsi jadwal"
                        style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: '#181817',
                            color: '#fff',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            cursor: 'pointer',
                            border: 'none'
                        }}
                    >
                        <MoreHorizontal size={19} strokeWidth={2.3} />
                    </button>

                    {isMenuOpen && (
                        <>
                            <div
                                style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                                onClick={() => setIsMenuOpen(false)}
                            />
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '46px',
                                    right: 0,
                                    width: '230px',
                                    background: '#FFF',
                                    borderRadius: '18px',
                                    border: '1px solid rgba(0, 0, 0, 0.08)',
                                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.16)',
                                    padding: '8px',
                                    zIndex: 95,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => { setIsMenuOpen(false); handleShareSchedule(); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        background: '#181817',
                                        color: '#FFF',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <Share2 size={16} color="#FFF" />
                                    <span>Bagikan Rekap Hari Ini</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsMenuOpen(false); handleDownloadRecap('month'); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        background: '#FAF8F5',
                                        color: 'var(--ink)',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <Download size={16} color="var(--ink)" />
                                    <span>Unduh Rekap Bulan Ini</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsMenuOpen(false); handleDownloadRecap('week'); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 14px',
                                        borderRadius: '12px',
                                        background: 'transparent',
                                        color: 'var(--muted)',
                                        border: 'none',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <Download size={15} color="var(--muted)" />
                                    <span>Unduh Rekap Minggu Ini</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* DATE PICKER */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '8px 20px 0', marginTop: '2px' }}>
                <button type="button" onClick={handlePrevMonth} style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#F3F4F6', color: 'var(--ink)', cursor: 'pointer' }}>
                    <ChevronLeft size={20} />
                </button>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <select
                            value={selectedDate.getMonth()}
                            onChange={(e) => {
                                const d = new Date(selectedDate);
                                d.setDate(1);
                                d.setMonth(parseInt(e.target.value));
                                handleSelectDate(d);
                            }}
                            style={{ appearance: 'none', WebkitAppearance: 'none', border: 'none', background: 'transparent', fontSize: '16px', letterSpacing: '-0.025em', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer', outline: 'none', padding: '0 16px 0 0', position: 'relative', zIndex: 2 }}
                        >
                            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: 0, color: 'var(--ink)', zIndex: 1, pointerEvents: 'none' }} />
                    </div>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <select
                            value={selectedDate.getFullYear()}
                            onChange={(e) => {
                                const d = new Date(selectedDate);
                                d.setDate(1);
                                d.setFullYear(parseInt(e.target.value));
                                handleSelectDate(d);
                            }}
                            style={{ appearance: 'none', WebkitAppearance: 'none', border: 'none', background: 'transparent', fontSize: '16px', letterSpacing: '-0.025em', fontWeight: 700, color: 'var(--ink)', cursor: 'pointer', outline: 'none', padding: '0 16px 0 0', position: 'relative', zIndex: 2 }}
                        >
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: 0, color: 'var(--ink)', zIndex: 1, pointerEvents: 'none' }} />
                    </div>
                </div>
                <button type="button" onClick={handleNextMonth} style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#F3F4F6', color: 'var(--ink)', cursor: 'pointer' }}>
                    <ChevronRight size={20} />
                </button>
            </div>

            <div ref={scrollContainerRef} style={{ display: 'flex', overflowX: 'auto', gap: '10px', padding: '18px 20px 16px', scrollSnapType: 'x mandatory', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                {daysInMonth.map((date) => {
                    const isSelected = date.getDate() === selectedDate.getDate() && date.getMonth() === selectedDate.getMonth();
                    const dayName = DAYS[date.getDay()];
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const pillKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const isPast = pillKey < todayKey;
                    const bookingCount = monthSummary[pillKey] || 0;

                    return (
                        <div
                            key={date.toISOString()}
                            onClick={() => handleSelectDate(date)}
                            className={isSelected ? 'selected-day' : ''}
                            style={{
                                scrollSnapAlign: 'center', flexShrink: 0, width: '58px', height: '78px', borderRadius: '23px',
                                border: '1px solid', borderColor: isSelected ? (isPast ? '#4B5563' : 'var(--ink)') : '#FFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s',
                                background: isSelected ? (isPast ? '#4B5563' : 'var(--ink)') : (isPast ? '#F3F4F6' : '#fff'),
                                color: isSelected ? '#fff' : (isPast ? '#9CA3AF' : 'var(--ink)'),
                                boxShadow: isSelected ? '0 8px 16px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.03)',
                                position: 'relative'
                            }}
                        >
                            <span style={{ fontSize: '11px', fontWeight: 700, opacity: isSelected ? 0.75 : 0.4, marginBottom: '5px' }}>
                                {dayName}
                            </span>
                            <span style={{ fontSize: '21px', lineHeight: 1, fontWeight: 700 }}>
                                {date.getDate()}
                            </span>
                            {bookingCount > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '6px',
                                    display: 'flex',
                                    gap: '3px'
                                }}>
                                    {Array.from({ length: Math.min(3, bookingCount) }).map((_, idx) => (
                                        <div key={idx} style={{
                                            width: '4px',
                                            height: '4px',
                                            borderRadius: '50%',
                                            background: isSelected ? '#fff' : 'var(--ink)'
                                        }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* RINGKASAN */}
            <div style={{ padding: '0 20px', marginTop: '8px' }}>
                <div style={{ background: isHistory ? '#6B7280' : '#1C1C1E', borderRadius: '28px', padding: '20px', color: '#FFF', position: 'relative', overflow: 'hidden', boxShadow: '0 12px 26px rgba(24,24,23,0.10)', transition: 'background 0.3s' }}>
                    <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                    <div style={{ position: 'absolute', bottom: '-20px', right: '40px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, opacity: 0.52, letterSpacing: '1.05px' }}>RINGKASAN JADWAL</div>
                        {isHistory && (
                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                SELESAI
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: '25px', lineHeight: 1.1, letterSpacing: '-0.035em', fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: '5px' }}>
                        {DAYS[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', fontSize: '14px', fontWeight: 700 }}>
                        <span>Kapasitas Terisi</span>
                        <span>{capacityPercent}%</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.15)', height: '5px', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ background: '#FFF', height: '100%', borderRadius: '4px', width: `${capacityPercent}%` }} />
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.6, textAlign: 'right', marginTop: '7px' }}>
                        {usedCapacity} dari {totalCapacity} Slot Terisi
                    </div>

                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: '18px', padding: '12px 8px', marginTop: '18px', justifyContent: 'space-between' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{activeSessions}</div>
                            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>Sesi Aktif</div>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{emptySlotCount}</div>
                            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>Slot Kosong</div>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: '20px', fontWeight: 700 }}>{closedCount}</div>
                            <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>Ditutup</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FILTER PILLS */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '20px 20px 24px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                {['Semua', 'Slot kosong', 'Pagi', 'Sore', 'Malam'].map(chip => {
                    if (chip === 'Malam' && eveningSlots.length === 0) return null;
                    const isActive = activeChip === chip;
                    const count = chip === 'Slot kosong' ? emptySlotCount : chip === 'Pagi' ? morningSlots.length : chip === 'Sore' ? afternoonSlots.length : chip === 'Malam' ? eveningSlots.length : null;
                    return (
                        <button
                            key={chip}
                            onClick={() => setActiveChip(chip)}
                            style={{
                                padding: '10px 15px', borderRadius: '100px', fontSize: '14px', fontWeight: 700, flexShrink: 0,
                                background: isActive ? '#F5EEDD' : '#FFF', color: isActive ? '#A37834' : 'var(--ink)',
                                border: `1px solid ${isActive ? '#F5EEDD' : '#EAEAEA'}`, transition: '0.2s'
                            }}
                        >
                            {chip} {count !== null ? `· ${count}` : ''}
                        </button>
                    );
                })}
            </div>

            {/* TIMELINE */}
            <div style={{ padding: '0 20px' }}>
                {['Pagi', 'Sore', 'Malam'].map(block => {
                    if (activeChip !== 'Semua' && activeChip !== block && activeChip !== 'Slot kosong') return null;

                    const blockSlots = filteredSlots.filter(s => {
                        const h = parseInt(s.startTime.split(':')[0]);
                        if (block === 'Pagi') return h < 12;
                        if (block === 'Sore') return h >= 12 && h < 18;
                        return h >= 18;
                    });
                    if (blockSlots.length === 0) return null;

                    return (
                        <div key={block} style={{ marginBottom: '30px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '25px', lineHeight: 1, letterSpacing: '-0.035em', fontWeight: 700 }}>{block}</h3>
                                <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
                                    {blockSlots[0].startTime} — {blockSlots[blockSlots.length - 1].endTime}
                                </div>
                            </div>
                            <div>
                                {blockSlots.map(slot => (
                                    <TimelineSlot
                                        key={slot.startTime}
                                        time={slot.startTime}
                                        slot={slot}
                                        isSelected={selectedSlots.includes(slot.startTime)}
                                        onSelectToggle={isHistory ? undefined : () => toggleSelection(slot.startTime)}
                                        readOnly={isHistory}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* REPLACEMENT ADMIN NAV */}
            {!isHistory && selectedSlots.length > 0 && (
                <>
                    <style>{`.admin-nav { display: none !important; }`}</style>
                    <div style={{
                        position: 'fixed',
                        zIndex: 40,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 'calc(100% - 24px)',
                        maxWidth: '456px',
                        bottom: '12px',
                        height: '72px',
                        borderRadius: '28px',
                        background: '#FFF',
                        border: '1px solid rgba(0, 0, 0, .05)',
                        boxShadow: '0 18px 40px rgba(0, 0, 0, .15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 8px 0 24px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', background: '#222', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>{selectedSlots.length}</div>
                            <span style={{ fontSize: '15px', fontWeight: 600 }}>slot terpilih</span>
                        </div>
                        {selectedSlotIsClosed ? (
                            <button onClick={() => handleAction(true)} disabled={isSaving} style={{ padding: '14px 24px', borderRadius: '100px', background: '#111', color: '#fff', fontSize: '14px', fontWeight: 600 }}>
                                {isSaving ? 'Membuka...' : 'Buka slot'}
                            </button>
                        ) : (
                            <button onClick={() => setCloseModalOpen(true)} style={{ padding: '14px 24px', borderRadius: '100px', background: '#322120', color: '#fff', fontSize: '14px', fontWeight: 600 }}>Tutup slot</button>
                        )}
                    </div>
                </>
            )}



            {/* TUTUP SLOT MODAL */}
            {closeModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#FFF', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', color: '#111827' }}>
                        <div style={{ width: '40px', height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', margin: '0 auto 24px' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Tutup slot</h2>
                            <span style={{ fontSize: '13px', color: '#6B7280' }}>Rider tidak bisa booking</span>
                        </div>

                        <div style={{ marginBottom: '24px', padding: '12px 14px', borderRadius: '14px', background: '#F3F4F6', fontSize: '14px', color: '#4B5563' }}>
                            Berlaku untuk <b style={{ color: '#111827' }}>{selectedSlots.length} Slot Terpilih</b>
                        </div>

                        {/* Reasons Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                            {[
                                { title: 'Perawatan kuda', desc: 'Grooming, cek kuku' },
                                { title: 'Cuaca', desc: 'Hujan / arena basah' },
                                { title: 'Libur', desc: 'Hari besar' },
                                { title: 'Lainnya', desc: 'Tulis alasan' }
                            ].map(reason => {
                                const active = closeReason === reason.title;
                                return (
                                    <div
                                        key={reason.title}
                                        onClick={() => setCloseReason(reason.title)}
                                        style={{
                                            background: active ? '#EFF6FF' : '#F9FAFB',
                                            border: `1px solid ${active ? '#3B82F6' : '#E5E7EB'}`,
                                            borderRadius: '16px', padding: '16px', cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px', color: '#111827' }}>{reason.title}</div>
                                        <div style={{ fontSize: '12px', color: '#6B7280' }}>{reason.desc}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {closeReason === 'Lainnya' && (
                            <input
                                type="text"
                                placeholder="Tulis alasan penutupan..."
                                value={closeReasonCustom}
                                onChange={e => setCloseReasonCustom(e.target.value)}
                                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#111827', marginBottom: '24px', fontSize: '15px' }}
                            />
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setCloseModalOpen(false)} style={{ padding: '16px', flex: 1, borderRadius: '100px', background: '#F3F4F6', color: '#374151', fontSize: '15px', fontWeight: 700, border: 'none' }}>Batal</button>
                            <button onClick={() => handleAction(false)} disabled={isSaving} style={{ padding: '16px', flex: 2, borderRadius: '100px', background: '#4A7297', color: '#FFF', fontSize: '15px', fontWeight: 700, border: 'none' }}>
                                {isSaving ? 'Menyimpan...' : 'Tutup slot'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
