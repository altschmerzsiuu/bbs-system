
'use client';

import { ChevronLeft, MoreHorizontal, Check, Loader2, X, Share2, Camera, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { approveBookingAction, rejectBookingAction, resolveAttendanceAction, multiToggleSlotAction, assignHorseAction, cancelBookingAction } from '../actions';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';

import type {
    AdminSessionDetail,
    AdminSessionDetailParticipant,
} from '@/modules/bookings/booking-types';

interface AdminSessionDetailClientProps {
    session: AdminSessionDetail;
    horses: any[];
}

function getBookingStatusBadge(status: string) {
    switch (status) {
        case 'CONFIRMED':
            return { label: 'Terkonfirmasi', bg: '#DCFCE7', text: '#15803D' };
        case 'PENDING':
            return { label: 'Menunggu', bg: 'var(--warning-light)', text: 'var(--warning-dark)' };
        case 'MEMBER_CANCELLED':
            return { label: 'Dibatalkan', bg: '#FEE2E2', text: '#B91C1C' };
        case 'BBS_CANCELLED':
            return { label: 'Dibatalkan Admin', bg: '#FEE2E2', text: '#B91C1C' };
        case 'REJECTED':
            return { label: 'Ditolak', bg: '#FEE2E2', text: '#B91C1C' };
        case 'COMPLETED':
            return { label: 'Selesai', bg: '#E0E7FF', text: '#4338CA' };
        case 'NO_SHOW':
            return { label: 'Tidak Hadir', bg: '#F3F4F6', text: '#6B7280' };
        default:
            return { label: status, bg: 'rgba(0,0,0,0.05)', text: 'var(--ink)' };
    }
}

function extractReceiptUrl(notes: string | null | undefined): string | null {
    if (!notes) return null;
    const match = notes.match(/https?:\/\/[^\s\]\)]+/i);
    return match ? match[0] : null;
}

function getDayName(date: string) {
    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
    }).format(new Date(`${date}T00:00:00`));
}

function getDateLabel(date: string) {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(`${date}T00:00:00`));
}

function getAttendanceLabel(status: string) {
    switch (status) {
        case 'NOT_CHECKED_IN':
            return 'Belum';
        case 'ATTENDED':
            return 'Hadir';
        case 'NO_SHOW':
            return 'No-show';
        default:
            return 'Belum';
    }
}

function getAttendanceClass(status: string) {
    switch (status) {
        case 'ATTENDED':
            return 'ok';
        case 'NOT_CHECKED_IN':
            return 'wait';
        case 'NO_SHOW':
            return 'danger';
        default:
            return 'wait';
    }
}

function getInitials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function ParticipantRow({
    participant,
    isMenuOpen,
    onToggleMenu,
    isSelected,
    onToggleSelection,
    onOpenHorsePicker,
    onCancelBooking,
}: {
    participant: AdminSessionDetailParticipant;
    isMenuOpen: boolean;
    onToggleMenu: () => void;
    isSelected: boolean;
    onToggleSelection: () => void;
    onOpenHorsePicker: () => void;
    onCancelBooking?: () => void;
}) {
    return (
        <div
            style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                cursor: 'pointer'
            }}
            onClick={onToggleSelection}
        >
            <div
                style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    border: isSelected ? 'none' : '1.5px solid var(--muted)',
                    background: isSelected ? 'var(--ink)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                }}
            >
                {isSelected && <Check size={14} strokeWidth={3} />}
            </div>

            <div className="avatar sm">
                {participant.avatarUrl ? (
                    <img
                        src={participant.avatarUrl}
                        alt=""
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '50%',
                        }}
                    />
                ) : (
                    getInitials(participant.name)
                )}
            </div>

            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <span
                        style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--ink)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                        }}
                    >
                        {participant.name}
                    </span>

                    <span
                        className={`pill ${getAttendanceClass((participant.attendanceStatus || 'NOT_CHECKED_IN'))}`}
                        style={{
                            fontSize: '10px',
                            padding: '3px 8px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}
                    >
                        {getAttendanceLabel((participant.attendanceStatus || 'NOT_CHECKED_IN'))}
                    </span>
                </div>

                <div
                    style={{
                        marginTop: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}
                >
                    <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                        {participant.type === 'MEMBER'
                            ? 'Member'
                            : 'Casual'}
                    </span>
                    <div
                        onClick={(e) => { e.stopPropagation(); onOpenHorsePicker(); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            borderRadius: '100px',
                            background: participant.horseName ? 'rgba(0,0,0,0.04)' : 'transparent',
                            border: participant.horseName ? 'none' : '1px dashed var(--muted)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: participant.horseName ? 'var(--ink)' : 'var(--muted)',
                        }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M12.5 22H18v-3l-2-2v-3l1-2V8c0-1-1-1.5-2-1V5c0-1-1-1.5-2-1H9c-1 0-2 1-2 2v2c0 .5-.5 1-1 1H5l-1 2 2 3v3l-2 2v3h6.5" /><path d="M9 11v-1" /></svg>
                        {participant.horseName || 'Pilih Kuda'}
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
                style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    flexShrink: 0,
                }}
            >
                <MoreHorizontal size={18} />
            </button>

            {isMenuOpen && (
                <>
                    <div
                        onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: 9
                        }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: '40px',
                            right: 0,
                            background: '#fff',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(0,0,0,0.08)',
                            zIndex: 10,
                            overflow: 'hidden',
                            minWidth: '160px',
                        }}
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleMenu();
                                if (onCancelBooking) onCancelBooking();
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '12px 16px',
                                background: 'transparent',
                                border: 'none',
                                fontSize: '13.5px',
                                color: '#DC2626',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: 600,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#FEE2E2')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            <X size={15} color="#DC2626" />
                            <span>Batalkan Booking</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default function AdminSessionDetailClient({
    session,
    horses,
}: AdminSessionDetailClientProps) {
    const router = useRouter();

    const [openMenuParticipantId, setOpenMenuParticipantId] = useState<string | null>(null);
    const [rejectModalBookingId, setRejectModalBookingId] = useState<string | null>(null);

    const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);

    const [horsePickerParticipantId, setHorsePickerParticipantId] = useState<string | null>(null);
    const [isAssigningHorse, setIsAssigningHorse] = useState(false);
    const [pendingHorseId, setPendingHorseId] = useState<string | null | undefined>(undefined); // undefined = not chosen yet

    const handleAssignHorse = async () => {
        if (!horsePickerParticipantId || pendingHorseId === undefined) return;
        setIsAssigningHorse(true);
        const res = await assignHorseAction(horsePickerParticipantId, pendingHorseId);
        if (res.ok) {
            const horseName = pendingHorseId === null ? null : horses.find(h => h.id === pendingHorseId)?.name;
            toast.custom((t) => <AlertToast title="Berhasil" description={horseName ? `Kuda ${horseName} berhasil ditandai.` : 'Tanda kuda berhasil dilepas.'} onDismiss={() => toast.dismiss(t)} />);
            setHorsePickerParticipantId(null);
            setPendingHorseId(undefined);
            router.refresh();
        } else {
            toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Gagal menandai kuda.'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        }
        setIsAssigningHorse(false);
    };
    const [isClosingSession, setIsClosingSession] = useState(false);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [isRejecting, setIsRejecting] = useState<boolean>(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [isSavingAttendance, setIsSavingAttendance] = useState(false);
    const [approvingBookingId, setApprovingBookingId] = useState<string | null>(null);
    const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

    const participants = session.bookings
        .filter(booking => !['MEMBER_CANCELLED', 'BBS_CANCELLED', 'REJECTED', 'EXPIRED'].includes(booking.status))
        .flatMap((booking) => booking.participants);

    const handleMarkAttendance = async (status: 'ATTENDED' | 'NO_SHOW') => {
        if (selectedUsers.length === 0 || isSavingAttendance) return;
        setIsSavingAttendance(true);
        try {
            const updates = selectedUsers.map(id => ({
                bookingParticipantId: id,
                status,
                creditAction: status === 'NO_SHOW' ? 'CONSUMED' : undefined
            }));

            for (const update of updates) {
                await resolveAttendanceAction(update.bookingParticipantId, update.status, update.creditAction as any);
            }
            setSelectedUsers([]);
            toast.custom((t) => <AlertToast title="Berhasil" description={`Absensi ${status === 'ATTENDED' ? 'kehadiran' : 'tidak hadir'} berhasil disimpan.`} onDismiss={() => toast.dismiss(t)} />);
            router.refresh();
        } catch (e) {
            toast.custom((t) => <AlertToast title="Gagal" description="Terjadi kesalahan saat menyimpan absensi." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        } finally {
            setIsSavingAttendance(false);
        }
    };

    const handleToggleSessionStatus = async () => {
        setIsClosingSession(true);
        try {
            const payload = [{
                date: session.date,
                startTime: session.startTime,
                endTime: session.endTime,
                capacity: 2,
                closedReason: session.isOpen ? 'Ditutup oleh Admin' : null
            }];

            const res = await multiToggleSlotAction(payload, !session.isOpen);
            if (res.ok) {
                setIsSessionMenuOpen(false);
                router.refresh();
            } else {
                toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Gagal mengubah status sesi.'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
            }
        } catch (e) {
            toast.custom((t) => <AlertToast title="Error" description="Terjadi kesalahan saat memproses sesi." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        } finally {
            setIsClosingSession(false);
        }
    };

    const handleApproveBooking = async (bookingId: string) => {
        if (approvingBookingId || isRejecting) return;
        setApprovingBookingId(bookingId);
        try {
            const res = await approveBookingAction(bookingId);
            if (res.ok) {
                toast.custom((t) => <AlertToast title="Berhasil" description="Booking berhasil diterima." onDismiss={() => toast.dismiss(t)} />);
                router.refresh();
            } else {
                toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Gagal menerima booking.'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
            }
        } catch (err: any) {
            toast.custom((t) => <AlertToast title="Error" description="Terjadi kesalahan saat menerima booking." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        } finally {
            setApprovingBookingId(null);
        }
    };

    const handleRejectBooking = async () => {
        if (!rejectModalBookingId || isRejecting) return;
        setIsRejecting(true);
        try {
            const res = await rejectBookingAction(rejectModalBookingId, rejectionReason);
            if (res.ok) {
                setRejectModalBookingId(null);
                setRejectionReason('');
                toast.custom((t) => <AlertToast title="Berhasil" description="Booking berhasil ditolak." onDismiss={() => toast.dismiss(t)} />);
                router.refresh();
            } else {
                toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Gagal menolak booking.'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
            }
        } catch (err: any) {
            toast.custom((t) => <AlertToast title="Error" description="Terjadi kesalahan saat menolak booking." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        } finally {
            setIsRejecting(false);
        }
    };

    const [cancellingBooking, setCancellingBooking] = useState<{ bookingId: string; participantName: string } | null>(null);
    const [cancellationReason, setCancellationReason] = useState<string>('Dibatalkan oleh admin via WhatsApp');
    const [isCancelling, setIsCancelling] = useState(false);

    const handleConfirmCancelBooking = async () => {
        if (!cancellingBooking || isCancelling) return;
        setIsCancelling(true);
        try {
            const res = await cancelBookingAction(
                cancellingBooking.bookingId,
                cancellationReason.trim() || 'Dibatalkan oleh admin via WhatsApp'
            );
            if (res.ok) {
                toast.custom((t) => (
                    <AlertToast
                        title="Booking Berhasil Dibatalkan"
                        description={`Booking untuk ${cancellingBooking.participantName} telah dibatalkan. Kuota kredit member dikembalikan dan slot kembali kosong.`}
                        onDismiss={() => toast.dismiss(t)}
                    />
                ));
                setCancellingBooking(null);
                setCancellationReason('Dibatalkan oleh admin via WhatsApp');
                router.refresh();
            } else {
                toast.custom((t) => (
                    <AlertToast
                        title="Gagal Membatalkan"
                        description={res.message || 'Terjadi kesalahan saat membatalkan booking.'}
                        variant="destructive"
                        onDismiss={() => toast.dismiss(t)}
                    />
                ));
            }
        } catch (err: any) {
            toast.custom((t) => (
                <AlertToast
                    title="Error"
                    description="Terjadi kesalahan sistem saat membatalkan booking."
                    variant="destructive"
                    onDismiss={() => toast.dismiss(t)}
                />
            ));
        } finally {
            setIsCancelling(false);
        }
    };

    const MAX_CAPACITY = 2;
    const occupiedSeats = participants.length;
    const sessionStatusLabel = session.isOpen ? 'Terbuka' : 'Ditutup';
    const sessionStatusClass = session.isOpen ? 'ok' : 'wait';

    return (
        <section
            className="screen active"
            data-page="session-detail"
        >
            {/* HEADER */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    paddingBottom: '28px',
                    paddingTop: '8px',
                }}
            >
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Kembali"
                    style={{
                        width: '42px',
                        height: '42px',
                        flexShrink: 0,
                        borderRadius: '50%',
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: '#fff',
                        color: 'var(--ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        marginTop: '2px',
                    }}
                >
                    <ChevronLeft size={22} strokeWidth={2.5} />
                </button>

                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '28px',
                                fontFamily: 'var(--font-display)',
                                fontWeight: 600,
                                color: 'var(--ink)',
                                letterSpacing: '-0.02em',
                                lineHeight: 1.1,
                            }}
                        >
                            Sesi {session.startTime}
                        </div>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 400 }}>
                        {getDayName(session.date)}, {getDateLabel(session.date)} • 45 menit
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setIsSessionMenuOpen(true)} style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                        <MoreHorizontal size={20} />
                    </button>
                </div>
            </div>

            {/* RIDER CONTAINER */}
            <section
                className="card"
                style={{
                    padding: '20px',
                    marginBottom: '16px',
                }}
            >
                <div
                    style={{
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <b style={{ fontSize: '17px' }}>
                        Rider
                    </b>

                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        {occupiedSeats} dari {MAX_CAPACITY} Slot
                    </span>
                </div>

                <div>
                    {(() => {
                        const activeBookings = session.bookings.filter(b => !['MEMBER_CANCELLED', 'BBS_CANCELLED', 'REJECTED', 'EXPIRED'].includes(b.status));
                        const cancelledBookings = session.bookings.filter(b => ['MEMBER_CANCELLED', 'BBS_CANCELLED', 'REJECTED', 'EXPIRED'].includes(b.status));

                        return (
                            <>
                                {activeBookings.length === 0 ? (
                                    <div
                                        style={{
                                            padding: '24px 16px',
                                            textAlign: 'center',
                                            color: 'var(--muted)',
                                            fontSize: '13px',
                                            background: '#FAF8F5',
                                            borderRadius: '14px',
                                            border: '1px dashed #E2DCD0',
                                        }}
                                    >
                                        Belum ada rider aktif di sesi ini. Slot tersedia untuk dibooking.
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        {activeBookings.map((booking, index) => {
                                            const isPending = booking.status === 'PENDING';
                                            const statusBadge = getBookingStatusBadge(booking.status);
                                            const receiptUrl = extractReceiptUrl(booking.notes);

                                            return (
                                                <div
                                                    key={booking.id}
                                                    style={{
                                                        borderBottom:
                                                            index < activeBookings.length - 1
                                                                ? '1px solid rgba(0,0,0,0.06)'
                                                                : 'none',
                                                        paddingTop: index === 0 ? '8px' : '16px',
                                                        paddingBottom:
                                                            index < activeBookings.length - 1 ? '16px' : '0',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            marginBottom: '12px',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                                            Booking #{index + 1}
                                                        </span>

                                                        <span
                                                            style={{
                                                                fontSize: '11px',
                                                                fontWeight: 700,
                                                                color: statusBadge.text,
                                                                padding: '3px 8px',
                                                                background: statusBadge.bg,
                                                                borderRadius: '100px',
                                                            }}
                                                        >
                                                            {statusBadge.label}
                                                        </span>
                                                    </div>

                                                    {booking.notes && (
                                                        <div
                                                            style={{
                                                                background: booking.notes.includes('Fotografer') ? '#FEF3C7' : '#F4F4F5',
                                                                border: `1px solid ${booking.notes.includes('Fotografer') ? '#FDE68A' : '#E4E4E7'}`,
                                                                borderRadius: '10px',
                                                                padding: '10px 12px',
                                                                marginBottom: '12px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '8px',
                                                                fontSize: '12px',
                                                                color: booking.notes.includes('Fotografer') ? '#92400E' : 'var(--ink)',
                                                                fontWeight: 600,
                                                                flexWrap: 'wrap',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Camera size={15} strokeWidth={2} />
                                                                <span>{booking.notes.split('[Bukti:')[0].trim()}</span>
                                                            </div>

                                                            {receiptUrl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewReceiptUrl(receiptUrl)}
                                                                    style={{
                                                                        background: '#92400E',
                                                                        color: '#FFF',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        padding: '4px 10px',
                                                                        fontSize: '11px',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px',
                                                                    }}
                                                                >
                                                                    <Eye size={12} />
                                                                    <span>Lihat Bukti Transfer</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '4px',
                                                        }}
                                                    >
                                                        {booking.participants.map((p) => (
                                                            <ParticipantRow
                                                                key={p.id}
                                                                participant={p}
                                                                isMenuOpen={openMenuParticipantId === p.id}
                                                                onToggleMenu={() => setOpenMenuParticipantId(openMenuParticipantId === p.id ? null : p.id)}
                                                                isSelected={selectedUsers.includes(p.id)}
                                                                onToggleSelection={() => setSelectedUsers(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                                                                onOpenHorsePicker={() => setHorsePickerParticipantId(p.id)}
                                                                onCancelBooking={() => setCancellingBooking({ bookingId: booking.id, participantName: p.name })}
                                                            />
                                                        ))}
                                                    </div>

                                                    {isPending && (
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                gap: '8px',
                                                                marginTop: '16px',
                                                            }}
                                                        >
                                                            <button
                                                                onClick={() => setRejectModalBookingId(booking.id)}
                                                                style={{
                                                                    flex: 1,
                                                                    background: 'rgba(239,68,68,0.1)',
                                                                    color: '#ef4444',
                                                                    padding: '12px',
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                Tolak
                                                            </button>
                                                            <button
                                                                onClick={() => handleApproveBooking(booking.id)}
                                                                disabled={approvingBookingId === booking.id || isRejecting}
                                                                style={{
                                                                    flex: 1,
                                                                    background: 'var(--green)',
                                                                    color: '#fff',
                                                                    padding: '12px',
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '6px',
                                                                }}
                                                            >
                                                                {approvingBookingId === booking.id && <Loader2 size={16} className="spin" />}
                                                                Terima
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Riwayat Pembatalan */}
                                {cancelledBookings.length > 0 && (
                                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            Riwayat Pembatalan ({cancelledBookings.length})
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {cancelledBookings.map((booking, idx) => {
                                                const statusBadge = getBookingStatusBadge(booking.status);
                                                return (
                                                    <div key={booking.id} style={{ background: '#FAF8F5', borderRadius: '12px', padding: '12px 14px', border: '1px solid #ECE7DE' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
                                                                Booking #{idx + 1}
                                                            </span>
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: statusBadge.text, background: statusBadge.bg, padding: '2px 8px', borderRadius: '100px' }}>
                                                                {statusBadge.label}
                                                            </span>
                                                        </div>
                                                        {booking.cancellationReason && (
                                                            <div style={{ fontSize: '11px', color: '#B91C1C', marginBottom: '6px' }}>
                                                                Alasan: {booking.cancellationReason}
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            {booking.participants.map(p => (
                                                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.65 }}>
                                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EAE6DC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--muted)' }}>
                                                                        {p.name.charAt(0)}
                                                                    </div>
                                                                    <span style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'line-through' }}>
                                                                        {p.name}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            </section>

            {/* OPERATIONAL CONTAINER */}
            <section
                className="card"
                style={{
                    padding: '20px',
                    marginBottom: '24px',
                }}
            >
                <div
                    style={{
                        marginBottom: '8px',
                    }}
                >
                    <b style={{ fontSize: '17px' }}>
                        Operasional
                    </b>
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '16px',
                            padding: '13px 0',
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                        }}
                    >
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Lokasi</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right' }}>Borneo Berkuda Stable</span>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '16px',
                            padding: '13px 0',
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                        }}
                    >
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Durasi</span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>
                            45 menit
                        </span>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '16px',
                            padding: '13px 0',
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                        }}
                    >
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Kapasitas</span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{session.capacity} dari {MAX_CAPACITY} Slot</span>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '16px',
                            padding: '13px 0',
                        }}
                    >
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Status</span>
                        <span className={`pill ${sessionStatusClass}`} style={{ fontSize: '11px', padding: '4px 10px' }}>
                            {sessionStatusLabel}
                        </span>
                    </div>
                </div>
            </section>

            {rejectModalBookingId && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setRejectModalBookingId(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600 }}>Tolak booking</h3>
                        <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Alasan penolakan</label>
                        <textarea
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            placeholder="Tuliskan alasan untuk member..."
                            disabled={isRejecting}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px', fontSize: '14px', resize: 'none', marginBottom: '24px' }}
                        />
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                disabled={isRejecting}
                                onClick={() => setRejectModalBookingId(null)}
                                style={{ flex: 1, background: '#f1f5f9', color: '#475569', padding: '12px', fontSize: '14px', border: 'none', borderRadius: '8px' }}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                disabled={isRejecting || !rejectionReason.trim()}
                                onClick={handleRejectBooking}
                                style={{ flex: 1, background: 'var(--danger, #ef4444)', color: '#fff', padding: '12px', fontSize: '14px', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {isRejecting && <Loader2 size={16} className="spin" />}
                                Tolak booking
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {cancellingBooking && (
                <div
                    onClick={(e) => { if (e.target === e.currentTarget && !isCancelling) setCancellingBooking(null); }}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999,
                        padding: '16px'
                    }}
                >
                    <div style={{ background: '#FFF', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Batalkan Booking</h2>
                                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0' }}>
                                    Rider: <b style={{ color: 'var(--ink)' }}>{cancellingBooking.participantName}</b>
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={isCancelling}
                                onClick={() => setCancellingBooking(null)}
                                style={{ background: '#F5F5F5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)' }}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 16px' }}>
                            Booking akan dibatalkan langsung. Slot sesi akan dikosongkan dan kuota sesi member akan dikembalikan otomatis.
                        </p>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                                Alasan Pembatalan
                            </label>
                            <input
                                type="text"
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                placeholder="Contoh: Konfirmasi batal via WhatsApp"
                                disabled={isCancelling}
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    border: '1px solid #E2DCD0',
                                    fontSize: '13.5px',
                                    outline: 'none',
                                    background: '#FAF8F5',
                                    color: 'var(--ink)'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                disabled={isCancelling}
                                onClick={() => setCancellingBooking(null)}
                                style={{
                                    flex: 1,
                                    height: '46px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    background: '#FFF',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    color: 'var(--ink)',
                                }}
                            >
                                Kembali
                            </button>
                            <button
                                type="button"
                                disabled={isCancelling}
                                onClick={handleConfirmCancelBooking}
                                style={{
                                    flex: 1.3,
                                    height: '46px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: '#DC2626',
                                    color: '#FFF',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: isCancelling ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                                }}
                            >
                                {isCancelling ? <Loader2 size={16} className="spin" /> : <X size={16} strokeWidth={2.5} />}
                                <span>{isCancelling ? 'Membatalkan...' : 'Ya, Batalkan'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSessionMenuOpen && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setIsSessionMenuOpen(false); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#FFF', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Opsi Sesi</h2>
                            <button onClick={() => setIsSessionMenuOpen(false)} style={{ padding: '8px', background: '#F5F5F5', borderRadius: '50%', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={handleToggleSessionStatus}
                                disabled={isClosingSession}
                                style={{ padding: '16px', borderRadius: '16px', background: session.isOpen ? '#FFF0F0' : '#F0F7F1', color: session.isOpen ? '#D32F2F' : '#24723C', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', opacity: isClosingSession ? 0.5 : 1, border: 'none', cursor: 'pointer' }}
                            >
                                {isClosingSession ? <Loader2 size={18} className="spin" /> : null}
                                {session.isOpen ? 'Tutup Sesi' : 'Buka Sesi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {horsePickerParticipantId && (
                <div onClick={(e) => { if (e.target === e.currentTarget && !isAssigningHorse) { setHorsePickerParticipantId(null); setPendingHorseId(undefined); } }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#FFF', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '28px 24px', paddingBottom: 'max(env(safe-area-inset-bottom, 24px), 32px)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Tandai Kuda</h2>
                                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0' }}>Pilih kuda, lalu tekan Konfirmasi</p>
                            </div>
                            <button disabled={isAssigningHorse} onClick={() => { setHorsePickerParticipantId(null); setPendingHorseId(undefined); }} style={{ padding: '8px', background: '#F5F5F5', borderRadius: '50%', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '24px', marginBottom: '24px' }}>
                            {horses.map(horse => {
                                const isSelected = pendingHorseId === horse.id;
                                return (
                                    <button
                                        key={horse.id}
                                        disabled={isAssigningHorse}
                                        onClick={() => setPendingHorseId(isSelected ? undefined : horse.id)}
                                        style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                            background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px',
                                            opacity: isAssigningHorse ? 0.5 : 1,
                                        }}
                                    >
                                        <div style={{
                                            width: '52px', height: '52px', borderRadius: '16px',
                                            background: isSelected ? 'var(--ink)' : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            border: isSelected ? '2px solid var(--ink)' : '2px solid transparent',
                                            transition: 'all 0.15s ease',
                                        }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#fff' : 'var(--ink)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}><path d="M12.5 22H18v-3l-2-2v-3l1-2V8c0-1-1-1.5-2-1V5c0-1-1-1.5-2-1H9c-1 0-2 1-2 2v2c0 .5-.5 1-1 1H5l-1 2 2 3v3l-2 2v3h6.5" /><path d="M9 11v-1" /></svg>
                                        </div>
                                        <span style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--ink)' : 'var(--muted)' }}>{horse.name}</span>
                                    </button>
                                );
                            })}
                            <button
                                disabled={isAssigningHorse}
                                onClick={() => setPendingHorseId(pendingHorseId === null ? undefined : null)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                    background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px',
                                    opacity: isAssigningHorse ? 0.5 : 1,
                                }}
                            >
                                <div style={{
                                    width: '52px', height: '52px', borderRadius: '16px',
                                    border: pendingHorseId === null ? '2px solid var(--ink)' : '1.5px dashed #cbd5e1',
                                    background: pendingHorseId === null ? 'var(--ink)' : '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: pendingHorseId === null ? '#fff' : '#cbd5e1',
                                    transition: 'all 0.15s ease',
                                }}><X size={22} /></div>
                                <span style={{ fontSize: '12px', fontWeight: pendingHorseId === null ? 700 : 600, color: pendingHorseId === null ? 'var(--ink)' : 'var(--muted)' }}>Lepas Tanda</span>
                            </button>
                        </div>

                        <button
                            onClick={handleAssignHorse}
                            disabled={isAssigningHorse || pendingHorseId === undefined}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '16px',
                                background: pendingHorseId === undefined ? 'rgba(0,0,0,0.06)' : 'var(--ink)',
                                color: pendingHorseId === undefined ? 'var(--muted)' : '#fff',
                                fontSize: '15px', fontWeight: 700, border: 'none',
                                cursor: pendingHorseId === undefined ? 'default' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {isAssigningHorse ? <Loader2 size={18} className="spin" /> : <Check size={18} strokeWidth={3} />}
                            {isAssigningHorse ? 'Menyimpan...' : 'Konfirmasi Pilihan'}
                        </button>
                    </div>
                </div>
            )}

            {selectedUsers.length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'calc(100% - 24px)',
                    maxWidth: '456px',
                    height: '72px',
                    background: '#161618',
                    borderRadius: '28px',
                    padding: '0 6px 0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 100,
                    boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
                    color: '#FFF'
                }}>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>
                        {selectedUsers.length} Rider
                    </div>
                    <div style={{ display: 'flex', gap: '8px', paddingRight: '4px' }}>
                        <button onClick={() => handleMarkAttendance('ATTENDED')} disabled={isSavingAttendance} style={{ background: '#FFF', color: 'var(--ink)', height: '48px', padding: '0 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                            Hadir
                        </button>
                        <button onClick={() => handleMarkAttendance('NO_SHOW')} disabled={isSavingAttendance} style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF', height: '48px', padding: '0 24px', borderRadius: '24px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                            Tidak Hadir
                        </button>
                    </div>
                </div>
            )}

            {/* Lightbox Bukti Transfer */}
            {previewReceiptUrl && (
                <div
                    onClick={() => setPreviewReceiptUrl(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(0,0,0,0.75)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#fff',
                            borderRadius: '20px',
                            maxWidth: '480px',
                            width: '100%',
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>Bukti Transfer Fotografer</span>
                            <button
                                onClick={() => setPreviewReceiptUrl(null)}
                                style={{ background: '#f4f4f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', justifyContent: 'center', background: '#faf8f5' }}>
                            <img
                                src={previewReceiptUrl}
                                alt="Bukti Transfer"
                                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)' }}
                            />
                        </div>
                        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                            <a
                                href={previewReceiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', textDecoration: 'underline' }}
                            >
                                Buka di tab baru
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
