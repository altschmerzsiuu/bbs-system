'use client';

import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import type { AdminScheduleSlot } from '@/modules/bookings/booking-types';
import { approveRidingRequestAction } from '@/app/(admin)/admin/schedule/actions';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { useState } from 'react';

interface SessionSlotProps {
    slot: AdminScheduleSlot;
    isSelected?: boolean;
    onSelectToggle?: () => void;
    readOnly?: boolean;
}

function getInitials(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function SessionSlot({ slot, isSelected, onSelectToggle, readOnly = false }: SessionSlotProps) {
    const router = useRouter();
    const participants = slot.booking?.participants ?? [];
    const isBooked = participants.length > 0;
    const isFull = participants.length >= slot.capacity;
    const [approvingReqId, setApprovingReqId] = useState<string | null>(null);

    const handleApproveRequest = async (e: React.MouseEvent, reqId: string) => {
        e.stopPropagation();
        if (approvingReqId) return;
        setApprovingReqId(reqId);
        
        // Use capacity 2 as default if it's a new slot being created
        const res = await approveRidingRequestAction(reqId, slot.date, slot.startTime, slot.capacity || 2);
        
        if (res.ok) {
            toast.custom((t) => <AlertToast title="Berhasil" description="Request disetujui dan booking dibuat." onDismiss={() => toast.dismiss(t)} />);
            router.refresh();
        } else {
            toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        }
        setApprovingReqId(null);
    };

    const handleClick = (e: React.MouseEvent) => {
        // If they click on the right side checkbox area, just toggle selection
        const target = e.target as HTMLElement;
        if (readOnly) return;
        if (target.closest('.slot-checkbox')) {
            e.stopPropagation();
            if (onSelectToggle) onSelectToggle();
            return;
        }

        // Otherwise navigate to detail if booked
        if (isBooked) {
            router.push(`/admin/schedule/${slot.id}`);
        } else {
            if (onSelectToggle) onSelectToggle();
        }
    };

    if (!slot.isOpen) {
        return (
            <div onClick={handleClick} style={{ background: '#322120', borderRadius: '18px', padding: '13px 14px', border: `2px solid ${isSelected ? '#D47D75' : '#322120'}`, cursor: readOnly ? 'default' : 'pointer', position: 'relative', boxShadow: isSelected ? '0 10px 24px rgba(50,33,32,0.22)' : '0 5px 18px rgba(50,33,32,0.10)', opacity: readOnly ? 0.58 : 1, filter: readOnly ? 'grayscale(0.85)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#FFF', fontSize: '14px', fontWeight: 700 }}>Slot tidak tersedia</span>
                        <span style={{ background: 'rgba(212,125,117,0.18)', color: '#F0AAA4', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>Ditutup</span>
                    </div>
                    {!readOnly && <div className="slot-checkbox" style={{ width: '24px', height: '24px', borderRadius: '6px', border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.35)', background: isSelected ? '#D47D75' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSelected && <Check size={14} color="#FFF" strokeWidth={3} />}
                    </div>}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '8px' }}>
                    Alasan: <b style={{ color: '#FFF' }}>{slot.closedReason || 'Ditutup oleh Admin'}</b>
                </div>
            </div>
        );
    }

    const hasPending = (slot.pendingRequests ?? []).length > 0;

    const renderPendingRequests = () => {
        if (!hasPending) return null;
        return (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(24,24,23,0.1)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#A37834', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {slot.pendingRequests!.length} Pending Request{slot.pendingRequests!.length > 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {slot.pendingRequests!.map(req => (
                        <div key={req.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#FDFBF7', padding: '10px', borderRadius: '8px', border: '1px solid #EBE4D5' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{req.memberName}</span>
                                <span style={{ fontSize: '10px', background: '#F5EEDD', color: '#A37834', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{req.type === 'JOY_RIDE' ? 'Joy Ride' : 'Casual'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                    onClick={() => {
                                        const phone = (req as any).memberPhone || '';
                                        if (!phone) {
                                            alert('Nomor HP tidak tersedia');
                                            return;
                                        }
                                        const message = encodeURIComponent(`Halo ${req.memberName}, dari Admin BBS. Terkait permohonan jadwal riding Anda...`);
                                        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                                    }}
                                    style={{ flex: 1, padding: '6px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    WA
                                </button>
                                <button 
                                    onClick={(e) => handleApproveRequest(e, req.id)}
                                    disabled={approvingReqId === req.id}
                                    style={{ flex: 1, padding: '6px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: approvingReqId === req.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                >
                                    {approvingReqId === req.id && <Loader2 size={12} className="spin" />}
                                    Terima
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!isBooked) {
        return (
            <div onClick={handleClick} style={{ background: '#FFF', border: `2px solid ${isSelected ? 'var(--ink)' : 'rgba(24,24,23,0.10)'}`, borderRadius: '18px', padding: '13px 14px', display: 'flex', flexDirection: 'column', cursor: readOnly ? 'default' : 'pointer', boxShadow: isSelected ? '0 9px 24px rgba(24,24,23,0.10)' : '0 5px 18px rgba(24,24,23,0.035)', opacity: readOnly ? 0.58 : 1, filter: readOnly ? 'grayscale(0.85)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>Tersedia</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>{slot.capacity} Slot Tersedia</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: '#F5EEDD', color: '#A37834', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>Kosong</span>
                        {!readOnly && <div className="slot-checkbox" style={{ width: '24px', height: '24px', borderRadius: '6px', border: isSelected ? 'none' : '2px solid #EAEAEA', background: isSelected ? 'var(--ink)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSelected && <Check size={14} color="#FFF" strokeWidth={3} />}
                        </div>}
                    </div>
                </div>
                {renderPendingRequests()}
            </div>
        );
    }

    // Booked Slot
    return (
        <div onClick={handleClick} style={{ background: isFull ? '#F0F7F1' : '#F4F7FB', border: `1px solid ${isFull ? '#CBE1D0' : '#D6E2F0'}`, borderRadius: '18px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '11px', cursor: readOnly ? 'default' : 'pointer', boxShadow: '0 6px 20px rgba(24,24,23,0.045)', opacity: readOnly ? 0.58 : 1, filter: readOnly ? 'grayscale(0.85)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <b style={{ fontSize: '14px', color: 'var(--ink)' }}>{isFull ? 'Sesi penuh' : 'Sesi terisi'}</b>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{participants.length}/{slot.capacity} rider terdaftar</div>
                </div>
                <span style={{ background: isFull ? '#D9EDDC' : '#E2ECF8', color: isFull ? '#24723C' : '#426987', padding: '4px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 700 }}>{isFull ? 'Penuh' : `${slot.capacity - participants.length} Slot Lagi`}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {participants.map((participant) => (
                    <div key={participant.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', border: '1px solid rgba(24,24,23,0.06)' }}>
                            {participant.avatarUrl ? <img src={participant.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(participant.name)}
                        </div>
                        <span style={{ fontSize: '14px', color: 'var(--ink)', fontWeight: 600 }}>{participant.name}</span>
                    </div>
                ))}
            </div>
            {renderPendingRequests()}
        </div>
    );
}
