'use client';

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import type { AdminScheduleSlot } from '@/modules/bookings/booking-types';

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

    if (!isBooked) {
        return (
            <div onClick={handleClick} style={{ background: '#FFF', border: `2px solid ${isSelected ? 'var(--ink)' : 'rgba(24,24,23,0.10)'}`, borderRadius: '18px', padding: '13px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: readOnly ? 'default' : 'pointer', boxShadow: isSelected ? '0 9px 24px rgba(24,24,23,0.10)' : '0 5px 18px rgba(24,24,23,0.035)', opacity: readOnly ? 0.58 : 1, filter: readOnly ? 'grayscale(0.85)' : 'none' }}>
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
        </div>
    );
}
