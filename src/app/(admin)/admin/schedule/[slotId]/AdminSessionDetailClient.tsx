
'use client';

import { ChevronLeft, MoreHorizontal, Check, Loader2, X, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { approveBookingAction, rejectBookingAction, resolveAttendanceAction, multiToggleSlotAction, assignHorseAction } from '../actions';
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
}: {
    participant: AdminSessionDetailParticipant;
    isMenuOpen: boolean;
    onToggleMenu: () => void;
    isSelected: boolean;
    onToggleSelection: () => void;
    onOpenHorsePicker: () => void;
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
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {participant.name}
                    </span>

                    <span
                        className={`pill ${getAttendanceClass((participant.attendanceStatus || 'NOT_CHECKED_IN'))}`}
                        style={{
                            fontSize: '10px',
                            padding: '3px 8px',
                        }}
                    >
                        {getAttendanceLabel((participant.attendanceStatus || 'NOT_CHECKED_IN'))}
                    </span>
                </div>

                <div
                    style={{
                        marginTop: '4px',
                        fontSize: '11px',
                        color: 'var(--muted)',
                    }}
                >
                    {participant.type === 'MEMBER'
                        ? 'Member'
                        : 'Casual'}
                </div>
            </div>

            <div 
                onClick={(e) => { e.stopPropagation(); onOpenHorsePicker(); }}
                style={{ 
                    marginRight: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '4px 8px', 
                    borderRadius: '100px', 
                    background: participant.horseName ? 'rgba(0,0,0,0.04)' : 'transparent',
                    border: participant.horseName ? 'none' : '1px dashed var(--muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: participant.horseName ? 'var(--ink)' : 'var(--muted)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M12.5 22H18v-3l-2-2v-3l1-2V8c0-1-1-1.5-2-1V5c0-1-1-1.5-2-1H9c-1 0-2 1-2 2v2c0 .5-.5 1-1 1H5l-1 2 2 3v3l-2 2v3h6.5"/><path d="M9 11v-1"/></svg>
                {participant.horseName || 'Pilih Kuda'}
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
                        onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
                        style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 16px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid rgba(0,0,0,0.05)',
                            fontSize: '14px',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                        }}
                    >
                        Batalkan Booking (Coming Soon)
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

    const handleAssignHorse = async (horseId: string | null) => {
        if (!horsePickerParticipantId) return;
        setIsAssigningHorse(true);
        const res = await assignHorseAction(horsePickerParticipantId, horseId);
        if (res.ok) {
            setHorsePickerParticipantId(null);
            router.refresh();
        } else {
            toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Unknown error'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        }
        setIsAssigningHorse(false);
    };
    const [isClosingSession, setIsClosingSession] = useState(false);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [isRejecting, setIsRejecting] = useState<boolean>(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [isSavingAttendance, setIsSavingAttendance] = useState(false);
    const [approvingBookingId, setApprovingBookingId] = useState<string | null>(null);

    const participants = session.bookings.flatMap(
        (booking) => booking.participants
    );

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
            alert('Absensi berhasil disimpan.');
            router.refresh();
        } catch (e) {
            alert('Terjadi kesalahan.');
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
                alert(`Gagal: ${res.message}`);
            }
        } catch (e) {
            alert('Terjadi kesalahan saat memproses sesi.');
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
                router.refresh();
            } else {
                alert(`Gagal menerima booking: ${res.message}`);
            }
        } catch (err: any) {
            alert('Terjadi kesalahan saat menerima booking.');
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
                router.refresh();
            } else {
                alert(`Gagal menolak booking: ${res.message}`);
            }
        } catch (err: any) {
            alert('Terjadi kesalahan saat menolak booking.');
        } finally {
            setIsRejecting(false);
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
                    {session.bookings.length === 0 ? (
                        <div
                            style={{
                                padding: '18px 0',
                                textAlign: 'center',
                                color: 'var(--muted)',
                                fontSize: '13px',
                            }}
                        >
                            Belum ada booking untuk sesi ini.
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {session.bookings.map((booking, index) => {
                                const isPending = booking.status === 'PENDING';

                                return (
                                    <div
                                        key={booking.id}
                                        style={{
                                            borderBottom:
                                                index < session.bookings.length - 1
                                                    ? '1px solid rgba(0,0,0,0.06)'
                                                    : 'none',
                                            paddingTop: index === 0 ? '8px' : '16px',
                                            paddingBottom:
                                                index < session.bookings.length - 1 ? '16px' : '0',
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
                                                    color: isPending ? 'var(--warning-dark)' : 'var(--ink)',
                                                    padding: '2px 6px',
                                                    background: isPending ? 'var(--warning-light)' : 'rgba(0,0,0,0.05)',
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                {booking.status}
                                            </span>
                                        </div>

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
                            {(() => {
                                const [startHour, startMinute] = session.startTime.split(':').map(Number);
                                const [endHour, endMinute] = session.endTime.split(':').map(Number);
                                const start = startHour * 60 + startMinute;
                                const end = endHour * 60 + endMinute;
                                return `${end - start} menit`;
                            })()}
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
                <div onClick={(e) => { if(e.target === e.currentTarget) setRejectModalBookingId(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px' }}>
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

            {isSessionMenuOpen && (
                <div onClick={(e) => { if(e.target === e.currentTarget) setIsSessionMenuOpen(false); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
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
                <div onClick={(e) => { if(e.target === e.currentTarget && !isAssigningHorse) setHorsePickerParticipantId(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#FFF', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Tandai Kuda</h2>
                            <button disabled={isAssigningHorse} onClick={() => setHorsePickerParticipantId(null)} style={{ padding: '8px', background: '#F5F5F5', borderRadius: '50%', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                            {horses.map(horse => (
                                <button
                                    key={horse.id}
                                    disabled={isAssigningHorse}
                                    onClick={() => handleAssignHorse(horse.id)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                        background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', opacity: isAssigningHorse ? 0.5 : 1
                                    }}
                                >
                                    <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M12.5 22H18v-3l-2-2v-3l1-2V8c0-1-1-1.5-2-1V5c0-1-1-1.5-2-1H9c-1 0-2 1-2 2v2c0 .5-.5 1-1 1H5l-1 2 2 3v3l-2 2v3h6.5"/><path d="M9 11v-1"/></svg>
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>{horse.name}</span>
                                </button>
                            ))}
                            <button
                                disabled={isAssigningHorse}
                                onClick={() => handleAssignHorse(null)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                    background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', opacity: isAssigningHorse ? 0.5 : 1
                                }}
                            >
                                <div style={{ width: '48px', height: '48px', borderRadius: '16px', border: '1px dashed #cbd5e1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}><X size={24} /></div>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Lepas Tanda</span>
                            </button>
                        </div>
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
        </section>
    );
}
