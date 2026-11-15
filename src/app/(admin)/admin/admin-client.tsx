'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveAttendanceAction, assignHorseAction } from './schedule/actions';
import { createClient } from '@/infrastructure/supabase-browser';
import {
  Bell, Plus, MinusCircle, FileCheck, FileBarChart, Clock, ChevronRight, Hourglass, Calendar, AlertTriangle, Send, Search, Check, MessageCircle, X, Settings, CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import type {
  AdminHomeStats, PendingRequestSummary, UpcomingSession, CurrentSession
} from '@/modules/admin/admin-home-queries';

interface AdminClientProps {
  stats: AdminHomeStats;
  pending: PendingRequestSummary;
  pendingBookingsList?: any[];
  upcoming: UpcomingSession[];
  currentSession: CurrentSession | null;
  pastSessions?: UpcomingSession[];
  followUps?: any[];
  todayStr: string;
  adminName: string;
  adminAvatarUrl?: string | null;
  horses?: any[];
}

export function AdminClient({ stats, pending, pendingBookingsList = [], upcoming, currentSession, pastSessions = [], followUps = [], todayStr, adminName, adminAvatarUrl, horses = [] }: AdminClientProps) {
  const router = useRouter();
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState<string | null>(null);
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>([]);
  const [attendanceModalRider, setAttendanceModalRider] = useState<{ id: string; name: string } | null>(null);
  const [dismissedFollowUps, setDismissedFollowUps] = useState<string[]>([]);
  const [visibleFollowUps, setVisibleFollowUps] = useState(2);
  const [confirmNoShow, setConfirmNoShow] = useState<{ riderIds: string[]; name: string } | null>(null);
  const [horseAssignModal, setHorseAssignModal] = useState<{ participantId: string; riderName: string; currentHorseId: string | null } | null>(null);
  const [selectedPastSession, setSelectedPastSession] = useState<UpcomingSession | null>(null);
  const [isAssigningHorse, setIsAssigningHorse] = useState(false);


  // Background auto-refresh for near real-time updates
  useEffect(() => {
    const supabase = createClient();

    // Real-time listener for admin dashboard updates
    const channel = supabase
      .channel('admin_home_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_applications' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'riding_requests' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        router.refresh();
      })
      .subscribe();

    const interval = setInterval(() => {
      router.refresh();
    }, 60000); // Fallback 60 seconds

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [router]);

  const handleBatchMarkAttendance = async (participantIds: string[], status: 'ATTENDED' | 'NO_SHOW') => {
    setIsUpdatingAttendance(participantIds.join(','));
    try {
      let anyError = false;
      for (const id of participantIds) {
        const res = await resolveAttendanceAction(id, status, 'CONSUMED');
        if (!res || !res.ok) {
          anyError = true;
        }
      }
      if (!anyError) {
        const statusLabel = status === 'ATTENDED' ? 'Hadir' : 'Tidak Hadir';
        toast.custom((t) => <AlertToast title="Berhasil" description={`Status absensi (${statusLabel}) berhasil disimpan.`} onDismiss={() => toast.dismiss(t)} />);
        setSelectedRiderIds([]);
        setAttendanceModalRider(null);
        router.refresh();
      } else {
        toast.custom((t) => <AlertToast title="Gagal" description="Gagal menyimpan absensi sebagian rider." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      toast.custom((t) => <AlertToast title="Error" description="Terjadi kesalahan yang tidak terduga." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    } finally {
      setIsUpdatingAttendance(null);
    }
  };

  const handleAssignHorse = async (participantId: string, horseId: string | null) => {
    setIsAssigningHorse(true);
    try {
      const res = await assignHorseAction(participantId, horseId);
      if (res && res.ok) {
        toast.custom((t) => <AlertToast title="Berhasil" description={horseId ? "Kuda berhasil ditugaskan." : "Penugasan kuda dibatalkan."} onDismiss={() => toast.dismiss(t)} />);
        setHorseAssignModal(null);
        if (selectedPastSession) {
          setSelectedPastSession(prev => {
            if (!prev) return null;
            return {
              ...prev,
              ridersList: prev.ridersList?.map(r => r.id === participantId ? {
                ...r,
                horseId,
                horseName: horseId ? (horses.find(h => h.id === horseId)?.name || 'Kuda') : null
              } : r)
            };
          });
        }
        router.refresh();
      } else {
        toast.custom((t) => <AlertToast title="Gagal" description={res?.message || "Gagal menugaskan kuda."} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      }
    } catch (e) {
      console.error(e);
      toast.custom((t) => <AlertToast title="Error" description="Terjadi kesalahan." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    } finally {
      setIsAssigningHorse(false);
    }
  };

  return (
    <>
      <div className="appbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/admin/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="avatar" style={{ cursor: 'pointer', overflow: 'hidden' }}>
              {adminAvatarUrl ? (
                <img src={adminAvatarUrl} alt={adminName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                adminName.substring(0, 2).toUpperCase()
              )}
            </div>
          </Link>
          <div className="titles" style={{ display: 'flex', flexDirection: 'column' }}>
            <b style={{ fontSize: '20px', color: 'var(--ink)' }}>
              Halo, {adminName}
            </b>
            <span style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} | Admin
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/admin/settings" className="iconbtn" title="Settings Kandang" style={{ color: 'inherit' }}>
            <Settings size={17} strokeWidth={2} />
          </Link>
        </div>
      </div>

      <div className="attention" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ color: 'var(--goldSoft)' }}>Perlu keputusan kamu</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFF', margin: '4px 0 0', lineHeight: 1.2 }}>
            Ringkasan Approval
          </div>
        </div>

        {/* ── CONTAINER CARD GLOSSY: BOOKING MEMBER BARU BUTUH APPROVAL ── */}
        <div
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: '16px',
            padding: '16px',
            color: '#FFF',
            boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '38px', fontWeight: 800, color: '#FFF', marginTop: '2px', lineHeight: 1 }}>
                {pending.booking}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>
                Permintaan butuh approval
              </div>
            </div>
            {pending.booking > 0 && (
              <Link
                href="/admin/applications?tab=booking"
                style={{
                  textDecoration: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: '100px',
                  background: 'rgba(217, 119, 6, 0.25)',
                  color: '#FDE68A',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  whiteSpace: 'nowrap'
                }}
              >
                Review ({pending.booking})
              </Link>
            )}
          </div>

          {pendingBookingsList && pendingBookingsList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingBookingsList.slice(0, 3).map((b: any) => {
                const riderNames = (b.booking_participants || []).map((p: any) =>
                  p.participant_type === 'MEMBER' ? p.members?.full_name : p.casual_customers?.full_name
                ).filter(Boolean).join(', ') || 'Rider';
                const slot = b.session_slots;
                const dateStr = slot ? new Date(`${slot.slot_date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
                const timeStr = slot ? `${slot.start_time.slice(0, 5)} — ${slot.end_time?.slice(0, 5) || ''}` : '';

                return (
                  <div
                    key={b.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {riderNames}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                        {dateStr} • {timeStr}
                      </div>
                      {b.notes && (
                        <div style={{ fontSize: '10.5px', color: '#FDE68A', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.notes}
                        </div>
                      )}
                    </div>
                    <Link
                      href="/admin/applications?tab=booking"
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: 'var(--ink)',
                        background: '#FAF6ED',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        flexShrink: 0
                      }}
                    >
                      Review
                    </Link>
                  </div>
                );
              })}
              {pendingBookingsList.length > 3 && (
                <Link
                  href="/admin/applications?tab=booking"
                  style={{ fontSize: '11.5px', color: '#FDE68A', textAlign: 'center', textDecoration: 'none', fontWeight: 600, marginTop: '2px' }}
                >
                  +{pendingBookingsList.length - 3} booking lainnya...
                </Link>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
              Tidak ada bookingan member baru yang menunggu konfirmasi saat ini.
            </div>
          )}
        </div>

        {/* ── STAT GRID PER KATEGORI: UKURAN SERAGAM ── */}
        <div className="statgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', alignItems: 'stretch' }}>
          {[
            { href: '/admin/applications?tab=booking', count: pending.reschedule, label: 'Reschedule' },
            { href: '/admin/applications?tab=membership', count: pending.membership, label: 'Membership' },
            { href: '/admin/applications?tab=riding', count: pending.riding, label: 'Casual Riding' }
          ].map((item, idx) => (
            <Link key={idx} href={item.href} style={{ textDecoration: 'none', display: 'flex', width: '100%', height: '100%' }}>
              <div
                className="stat"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '86px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  padding: '14px 12px',
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '16px',
                  color: '#FFF',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  backdropFilter: 'blur(8px)',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <strong style={{ fontSize: '26px', color: '#FFF', fontWeight: 800, lineHeight: 1 }}>{item.count}</strong>
                <span style={{ color: 'rgba(255,255,255,0.75)', marginTop: '8px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.2px', display: 'flex', alignItems: 'flex-end', minHeight: '26px', lineHeight: 1.2 }}>
                  {item.label}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <Link
          href="/admin/applications"
          className="btn gold"
          style={{ position: 'relative', zIndex: 2, textDecoration: 'none', display: 'flex', justifyContent: 'center', color: 'var(--ink)', fontWeight: 700 }}
        >
          Review Semua Permintaan Sekarang
        </Link>
      </div>


      {followUps && followUps.length > 0 && (
        <>
          <div className="sectionhead">
            <b>Perlu Tindakan</b>
          </div>
          <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
            {followUps.filter(f => !dismissedFollowUps.includes(f.id)).length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>Semua tindakan sudah diselesaikan.</div>
            ) : (
              <>
                {followUps.filter(f => !dismissedFollowUps.includes(f.id)).slice(0, visibleFollowUps).map((item, i, arr) => {
                  const bgColors = {
                    red: 'var(--redSoft)',
                    orange: '#FFF4E5',
                    blue: '#E3F2FD'
                  };
                  const fgColors = {
                    red: 'var(--red)',
                    orange: '#ED6C02',
                    blue: '#1976D2'
                  };
                  const bgColor = bgColors[item.urgency as keyof typeof bgColors] || 'var(--redSoft)';
                  const fgColor = fgColors[item.urgency as keyof typeof fgColors] || 'var(--red)';

                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none', position: 'relative' }}>
                      <button
                        onClick={() => setDismissedFollowUps([...dismissedFollowUps, item.id])}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}
                      >
                        <X size={16} />
                      </button>
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1, paddingRight: '24px' }}>
                        <div style={{ background: bgColor, color: fgColor, padding: '10px', borderRadius: '12px', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: '2px' }}>
                          {item.icon === 'Hourglass' ? <Hourglass size={18} /> : item.icon === 'Calendar' ? <Calendar size={18} /> : <AlertTriangle size={18} />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <b style={{ fontSize: '13px', lineHeight: '1.4' }}>{item.title}</b>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.subtitle}</span>
                          <div style={{ marginTop: '6px' }}>
                            <button
                              onClick={() => {
                                if (item.actionText === 'Chat') {
                                  const name = item.title.includes('-') ? item.title.split(' - ')[0].trim() : 'Kak';
                                  let message = '';
                                  if (item.title.toLowerCase().includes('membership')) {
                                    const pkgMatch = item.subtitle.split('·')[0].trim();
                                    const pkgName = pkgMatch ? `paket ${pkgMatch}` : 'paketnya';
                                    message = `Halo Kak ${name}, mau ngingatin kalau membership ${pkgName} akan habis. Apakah ada rencana mau diperpanjang? 😊`;
                                  } else {
                                    const topic = item.title.includes('-') ? item.title.split(' - ')[1].trim().toLowerCase() : item.title.toLowerCase();
                                    message = `Halo Kak ${name}, mau ngingatin kalau ${topic}. Apakah ada rencana mau diperpanjang? 😊`;
                                  }
                                  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                                } else if (item.actionText === 'Cek') {
                                  router.push('/admin/applications');
                                } else {
                                  toast.custom((t) => <AlertToast title="Kirim Info" description={`Info terkirim untuk: ${item.title}`} onDismiss={() => toast.dismiss(t)} />);
                                }
                              }}
                              style={{
                                padding: '6px 14px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '6px',
                                flexShrink: 0, width: 'fit-content', whiteSpace: 'nowrap',
                                border: 'none', cursor: 'pointer', borderRadius: '100px',
                                fontSize: '12px',
                                ...(item.actionText === 'Chat'
                                  ? { background: '#dcfce7', color: '#16a34a' }
                                  : item.actionText === 'Cek'
                                    ? { background: '#e0e7ff', color: '#4338ca' }
                                    : { background: '#FFF4E5', color: '#c05621' })
                              }}
                            >
                              {item.actionIcon === 'MessageCircle' ? <MessageCircle size={13} /> : item.actionIcon === 'Search' ? <Search size={13} /> : item.actionIcon === 'Send' ? <Send size={13} /> : null}
                              {item.actionText}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {followUps.filter(f => !dismissedFollowUps.includes(f.id)).length > visibleFollowUps ? (
                  <button
                    onClick={() => setVisibleFollowUps(v => v + 2)}
                    style={{ padding: '12px', background: 'none', border: 'none', borderTop: '1px solid var(--line)', color: 'var(--accent)', fontWeight: 600, width: '100%', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Muat lebih banyak
                  </button>
                ) : visibleFollowUps > 2 ? (
                  <button
                    onClick={() => setVisibleFollowUps(2)}
                    style={{ padding: '12px', background: 'none', border: 'none', borderTop: '1px solid var(--line)', color: 'var(--muted)', fontWeight: 600, width: '100%', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Tampilkan lebih sedikit
                  </button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}

      {/* 1. Sedang Berjalan */}
      <div className="sectionhead" style={{ marginTop: '24px' }}>
        <b>Sedang berjalan</b>
        <Link href="/admin/schedule" style={{ color: 'inherit', textDecoration: 'none' }}>Lihat jadwal</Link>
      </div>
      {currentSession && currentSession.riders.length > 0 ? (
        <>
          <div className="card">
            <div className="cardhead" style={{ alignItems: 'center' }}>
              <b style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--ink)' }}>{currentSession.timeRange}</b>
              <span className="pill ok" style={{ background: 'var(--greenSoft)', color: 'var(--green)' }}>Berlangsung</span>
            </div>
            <div className="who" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  Daftar Rider
                </span>
                {currentSession.riders.filter(r => r.attendanceStatus === 'NOT_CHECKED_IN').length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const unchecked = currentSession.riders
                        .filter(r => r.attendanceStatus === 'NOT_CHECKED_IN')
                        .map(r => r.id);
                      if (selectedRiderIds.length === unchecked.length) {
                        setSelectedRiderIds([]);
                      } else {
                        setSelectedRiderIds(unchecked);
                      }
                    }}
                    title={selectedRiderIds.length === currentSession.riders.filter(r => r.attendanceStatus === 'NOT_CHECKED_IN').length ? 'Batal pilih semua' : 'Pilih semua rider'}
                    style={{
                      background: selectedRiderIds.length > 0 ? '#FAF6ED' : 'transparent',
                      border: selectedRiderIds.length > 0 ? '1px solid #EBE4D5' : '1px solid transparent',
                      borderRadius: '8px',
                      padding: '3px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: selectedRiderIds.length > 0 ? '#8C6E2D' : 'var(--muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckCheck size={15} strokeWidth={2.4} />
                    <span>{selectedRiderIds.length === currentSession.riders.filter(r => r.attendanceStatus === 'NOT_CHECKED_IN').length ? 'Batal' : 'Semua'}</span>
                  </button>
                )}
              </div>

              {currentSession.riders.map(rider => {
                const isSelected = selectedRiderIds.includes(rider.id);
                const isNotCheckedIn = rider.attendanceStatus === 'NOT_CHECKED_IN';

                return (
                  <div
                    key={rider.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: isSelected ? '#FAF8F5' : '#FFF',
                      border: isSelected ? '1px solid #EBE4D5' : '1px solid var(--line)',
                      cursor: isNotCheckedIn ? 'pointer' : 'default',
                      opacity: isNotCheckedIn ? 1 : 0.85,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}
                      onClick={() => {
                        if (isNotCheckedIn) {
                          setSelectedRiderIds(prev =>
                            prev.includes(rider.id) ? prev.filter(x => x !== rider.id) : [...prev, rider.id]
                          );
                        }
                      }}
                    >
                      {isNotCheckedIn ? (
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: isSelected ? 'var(--ink)' : 'var(--paper)',
                          border: isSelected ? 'none' : '1px solid var(--muted)',
                          display: 'grid', placeItems: 'center', color: '#FFF', flexShrink: 0
                        }}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                      ) : (
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: 'var(--green)', color: '#FFF',
                          display: 'grid', placeItems: 'center', flexShrink: 0
                        }}>
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}

                      <div className="avatar sm" style={{ overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                        {rider.avatarUrl ? (
                          <img
                            src={rider.avatarUrl}
                            alt={rider.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: '50%',
                            }}
                          />
                        ) : (
                          rider.init
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{rider.name}</span>
                        {rider.horseName && (
                          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                            Kuda: {rider.horseName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {/* Attendance Pill */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isNotCheckedIn) {
                            setAttendanceModalRider({ id: rider.id, name: rider.name });
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center',
                          fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px',
                          background: isNotCheckedIn ? 'var(--paper)' : 'var(--greenSoft)',
                          color: isNotCheckedIn ? 'var(--muted)' : 'var(--green)',
                          cursor: isNotCheckedIn ? 'pointer' : 'default'
                        }}
                        title={isNotCheckedIn ? 'Klik untuk update absensi' : 'Sudah Hadir'}
                      >
                        {isNotCheckedIn ? 'Belum' : 'Hadir'}
                      </div>

                      {/* Right Arrow to assign horse */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHorseAssignModal({
                            participantId: rider.id,
                            riderName: rider.name,
                            currentHorseId: rider.horseId || null
                          });
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          borderRadius: '6px'
                        }}
                        title={rider.horseName ? `Ganti kuda (saat ini: ${rider.horseName})` : 'Assign kuda'}
                      >
                        <ChevronRight size={18} strokeWidth={2.2} color="var(--muted)" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="meter" style={{ marginTop: '14px' }}>
              <i className="green" style={{ width: `${currentSession.progressPercent}%`, background: 'var(--green)' }}></i>
            </div>
            <div className="meterlabel">
              <span>{currentSession.elapsedText}</span>
              <span>{currentSession.remainingText}</span>
            </div>
          </div>

          {/* Floating action bar replacing bottom navbar when riders are selected */}
          {selectedRiderIds.length > 0 && currentSession && (
            <>
              <style>{`.admin-nav { display: none !important; }`}</style>
              <div style={{
                position: 'fixed',
                zIndex: 60,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100% - 24px)',
                maxWidth: '456px',
                bottom: '12px',
                height: '72px',
                borderRadius: '28px',
                background: '#FFF',
                border: '1px solid rgba(0, 0, 0, .06)',
                boxShadow: '0 18px 40px rgba(0, 0, 0, .16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    background: 'var(--ink)',
                    borderRadius: '50%',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 700
                  }}>
                    {selectedRiderIds.length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                      {selectedRiderIds.length} rider dipilih
                    </span>
                    <button
                      onClick={() => setSelectedRiderIds([])}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: '11px',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        textDecoration: 'underline'
                      }}
                    >
                      Batal
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    disabled={isUpdatingAttendance !== null}
                    onClick={() => handleBatchMarkAttendance(selectedRiderIds, 'ATTENDED')}
                    style={{
                      background: 'var(--green)',
                      color: '#FFF',
                      border: 'none',
                      fontWeight: 700,
                      borderRadius: '100px',
                      padding: '10px 16px',
                      fontSize: '13px',
                      cursor: isUpdatingAttendance !== null ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(46, 125, 50, 0.25)'
                    }}
                  >
                    <Check size={16} strokeWidth={2.5} />
                    <span>Hadir</span>
                  </button>
                  <button
                    disabled={isUpdatingAttendance !== null}
                    onClick={() => {
                      const names = currentSession.riders
                        .filter(r => selectedRiderIds.includes(r.id))
                        .map(r => r.name)
                        .join(', ');
                      setConfirmNoShow({
                        riderIds: selectedRiderIds,
                        name: names
                      });
                    }}
                    style={{
                      background: '#FFF5F5',
                      color: 'var(--red)',
                      border: '1px solid #FED7D7',
                      fontWeight: 700,
                      borderRadius: '100px',
                      padding: '10px 14px',
                      fontSize: '13px',
                      cursor: isUpdatingAttendance !== null ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <X size={16} strokeWidth={2.5} />
                    <span>Tidak Hadir</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--paper)', borderRadius: '16px', border: '1px dashed var(--line)' }}>
          <Clock size={24} color="var(--muted)" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Tidak ada sesi yang sedang berjalan</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Sesi berikutnya akan otomatis muncul di sini</div>
        </div>
      )}

      {/* 2. Berikutnya */}
      <div className="sectionhead" style={{ marginTop: '32px' }}>
        <b>Berikutnya</b>
        <Link href="/admin/schedule" style={{ color: 'inherit', textDecoration: 'none' }}>Semua</Link>
      </div>
      {upcoming && upcoming.length > 0 ? (() => {
        // Group by slotDate
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const grouped: Record<string, typeof upcoming> = {};
        for (const s of upcoming) {
          const d = (s as any).slotDate || s.rawTime.split('T')[0];
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(s);
        }
        const sortedDates = Object.keys(grouped).sort();

        const formatDateLabel = (dateStr: string) => {
          if (dateStr === today) return 'Hari ini';
          if (dateStr === tomorrow) return 'Besok';
          const d = new Date(dateStr + 'T00:00:00');
          return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedDates.map(date => (
              <div key={date}>
                {/* Date label */}
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', paddingLeft: '4px' }}>
                  {formatDateLabel(date)}
                </div>
                <div className="rowlist">
                  {grouped[date].map(session => (
                    <Link key={session.id} href={`/admin/schedule/${session.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: session.riders === 0 ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <b>{session.time}</b>
                          <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>{session.duration} MNT</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingLeft: '8px' }}>
                          {session.riders > 0 ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {session.names.split(', ').slice(0, 3).map((name, idx) => (
                                  <div key={idx} style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'var(--accent)', color: '#FFF', display: 'grid', placeItems: 'center',
                                    fontSize: '10px', fontWeight: 700, border: '2px solid var(--paper)',
                                    marginLeft: idx > 0 ? '-10px' : '0', zIndex: 3 - idx
                                  }}>
                                    {name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                  </div>
                                ))}
                                {session.names.split(', ').length > 3 && (
                                  <div style={{
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: 'var(--muted)', color: '#FFF', display: 'grid', placeItems: 'center',
                                    fontSize: '10px', fontWeight: 700, border: '2px solid var(--paper)',
                                    marginLeft: '-10px', zIndex: 0
                                  }}>
                                    +{session.names.split(', ').length - 3}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                                <b style={{ fontSize: '13px' }}>{session.riders} Rider</b>
                                <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{session.names}</span>
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                              <b style={{ fontSize: '13px', color: 'var(--muted)' }}>Slot Kosong</b>
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Belum ada booking</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={18} color="var(--muted)" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })() : (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--paper)', borderRadius: '16px', border: '1px dashed var(--line)' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Tidak ada sesi berikutnya</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Semua sesi untuk hari ini telah selesai atau kosong</div>
        </div>
      )}

      {/* 3. Riwayat Sesi */}
      <div className="sectionhead" style={{ marginTop: '32px' }}>
        <b>Riwayat sesi hari ini</b>
      </div>
      {pastSessions && pastSessions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pastSessions.slice(0, 5).map(session => (
            <div
              key={session.id}
              onClick={() => setSelectedPastSession(session)}
              style={{
                cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '14px 16px',
                background: '#F6F6F6',
                borderRadius: '16px',
                border: '1px solid #EAEAEA',
                opacity: 0.9,
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <b style={{ fontSize: '15px', color: '#555', letterSpacing: '-0.2px' }}>{session.time}</b>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {session.names.split(' · ').slice(0, 3).map((name, idx) => (
                      <div key={idx} style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        background: '#DDD', color: '#666', display: 'grid', placeItems: 'center',
                        fontSize: '9px', fontWeight: 700, border: '2px solid #F6F6F6',
                        marginLeft: idx > 0 ? '-10px' : '0', zIndex: 3 - idx
                      }}>
                        {name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <b style={{ fontSize: '13px', color: '#444' }}>{session.riders} Rider</b>
                    <span style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                      {session.names}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#666', background: '#E8E8E8', padding: '4px 8px', borderRadius: '8px' }}>
                  Selesai
                </span>
                <ChevronRight size={16} color="#999" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', background: 'var(--paper)', borderRadius: '16px', border: '1px dashed var(--line)', marginBottom: '32px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Belum ada riwayat sesi</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Sesi yang telah berlalu hari ini akan muncul di sini</div>
        </div>
      )}

      <div style={{ height: '100px' }} />

      {/* ── MODAL PILIH ABSENSI SATUAN (HADIR / TIDAK HADIR) ── */}
      {attendanceModalRider && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && isUpdatingAttendance === null) {
              setAttendanceModalRider(null);
            }
          }}
        >
          <div
            style={{
              background: '#FFF', borderRadius: '24px', padding: '24px',
              width: 'calc(100% - 48px)', maxWidth: '340px', textAlign: 'center'
            }}
          >
            <div style={{ background: '#FAF6ED', color: '#8C6E2D', width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Clock size={26} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px', color: 'var(--ink)' }}>
              Absensi Rider
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '22px', lineHeight: 1.4 }}>
              Pilih status kehadiran untuk <b>{attendanceModalRider.name}</b> pada sesi ini:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                disabled={isUpdatingAttendance !== null}
                onClick={() => handleBatchMarkAttendance([attendanceModalRider.id], 'ATTENDED')}
                style={{
                  padding: '13px', borderRadius: '14px', border: 'none',
                  background: 'var(--green)', color: '#FFF', fontWeight: 700, fontSize: '14px',
                  cursor: isUpdatingAttendance !== null ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}
              >
                <Check size={16} strokeWidth={3} /> Tandai Hadir
              </button>
              <button
                disabled={isUpdatingAttendance !== null}
                onClick={() => {
                  const rider = attendanceModalRider;
                  setAttendanceModalRider(null);
                  setConfirmNoShow({ riderIds: [rider.id], name: rider.name });
                }}
                style={{
                  padding: '13px', borderRadius: '14px',
                  border: '1px solid var(--redSoft)', background: '#FFF',
                  color: 'var(--red)', fontWeight: 700, fontSize: '14px',
                  cursor: isUpdatingAttendance !== null ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <X size={16} strokeWidth={2.5} /> Tandai Tidak Hadir
              </button>
              <button
                onClick={() => setAttendanceModalRider(null)}
                style={{
                  padding: '12px', borderRadius: '14px', border: '1px solid var(--line)',
                  background: '#F9F9F9', color: 'var(--muted)', fontWeight: 600, fontSize: '13px',
                  cursor: 'pointer', marginTop: '4px'
                }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL KONFIRMASI TIDAK HADIR (NO SHOW) ── */}
      {confirmNoShow && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#FFF', borderRadius: '24px', padding: '24px',
            width: 'calc(100% - 48px)', maxWidth: '320px', textAlign: 'center'
          }}>
            <div style={{ background: 'var(--redSoft)', color: 'var(--red)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Tandai Tidak Hadir?</h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', lineHeight: '1.5' }}>
              Apakah kamu yakin ingin menandai <b>{confirmNoShow.name}</b> tidak hadir? Sesi ini akan hangus dan tidak dapat dikembalikan.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setConfirmNoShow(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '100px', border: '1px solid var(--line)', background: '#FFF', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Kembali
              </button>
              <button
                disabled={isUpdatingAttendance !== null}
                onClick={async () => {
                  const ids = confirmNoShow.riderIds;
                  setConfirmNoShow(null);
                  await handleBatchMarkAttendance(ids, 'NO_SHOW');
                }}
                style={{ flex: 1, padding: '12px', borderRadius: '100px', border: 'none', background: 'var(--red)', color: '#FFF', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Ya, Tandai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ASSIGN KUDA ── */}
      {horseAssignModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
            backdropFilter: 'blur(3px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isAssigningHorse) {
              setHorseAssignModal(null);
            }
          }}
        >
          <div
            style={{
              background: '#FFF', borderRadius: '24px', padding: '24px',
              width: 'calc(100% - 40px)', maxWidth: '360px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Penugasan Kuda
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)', margin: '2px 0 0' }}>
                  {horseAssignModal.riderName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHorseAssignModal(null)}
                disabled={isAssigningHorse}
                style={{ background: '#F4F4F5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
              Pilih kuda untuk rider ini:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '16px', paddingRight: '2px' }}>
              {horses && horses.length > 0 ? (
                horses.map(horse => {
                  const isCurrent = horseAssignModal.currentHorseId === horse.id;
                  return (
                    <button
                      key={horse.id}
                      type="button"
                      disabled={isAssigningHorse}
                      onClick={() => handleAssignHorse(horseAssignModal.participantId, horse.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', borderRadius: '14px',
                        border: isCurrent ? '2px solid #8C6E2D' : '1px solid var(--line)',
                        background: isCurrent ? '#FAF6ED' : '#FFF',
                        cursor: isAssigningHorse ? 'not-allowed' : 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isCurrent ? 'var(--gold)' : 'var(--border)',
                          }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: isCurrent ? 'var(--ink)' : 'var(--ink)' }}>
                          {horse.name}
                        </span>
                      </div>
                      {isCurrent ? (
                        <div style={{ background: '#8C6E2D', color: '#FFF', borderRadius: '50%', width: '20px', height: '20px', display: 'grid', placeItems: 'center' }}>
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)', fontSize: '13px' }}>
                  Belum ada data kuda aktif. Tambahkan kuda di menu Pengaturan Kandang.
                </div>
              )}

              {horseAssignModal.currentHorseId && (
                <button
                  type="button"
                  disabled={isAssigningHorse}
                  onClick={() => handleAssignHorse(horseAssignModal.participantId, null)}
                  style={{
                    padding: '11px', borderRadius: '12px',
                    border: '1px dashed #E57373', background: '#FFEBEE',
                    color: '#C62828', fontSize: '13px', fontWeight: 600,
                    cursor: isAssigningHorse ? 'not-allowed' : 'pointer',
                    marginTop: '4px'
                  }}
                >
                  Lepas Penugasan Kuda (Tanpa Kuda)
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setHorseAssignModal(null)}
              disabled={isAssigningHorse}
              style={{
                width: '100%', padding: '12px', borderRadius: '14px',
                border: '1px solid var(--line)', background: '#F9F9F9',
                color: 'var(--muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DETAIL RIWAYAT SESI HARI INI ── */}
      {selectedPastSession && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)', zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            backdropFilter: 'blur(3px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedPastSession(null);
            }
          }}
        >
          <div
            style={{
              background: '#FFF', borderRadius: '24px', padding: '24px',
              width: 'calc(100% - 32px)', maxWidth: '400px', maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 16px 40px rgba(0,0,0,0.22)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', background: '#ECECEC', color: '#666' }}>
                    Selesai
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                    {todayStr}
                  </span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
                  {selectedPastSession.time}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPastSession(null)}
                style={{ background: '#F4F4F5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Rider list */}
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', marginBottom: '10px' }}>
              Daftar Rider ({selectedPastSession.ridersList?.length || selectedPastSession.riders})
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '2px', marginBottom: '16px' }}>
              {selectedPastSession.ridersList && selectedPastSession.ridersList.length > 0 ? (
                selectedPastSession.ridersList.map(rider => (
                  <div
                    key={rider.id}
                    style={{
                      background: '#F9F9F9',
                      border: '1px solid #ECECEC',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar sm" style={{ overflow: 'hidden', width: '32px', height: '32px', fontSize: '11px' }}>
                          {rider.avatarUrl ? (
                            <img src={rider.avatarUrl} alt={rider.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            rider.init
                          )}
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                          {rider.name}
                        </span>
                      </div>

                      {/* Attendance badge */}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: rider.attendanceStatus === 'ATTENDED' ? 'var(--greenSoft)' : rider.attendanceStatus === 'NO_SHOW' ? 'var(--redSoft)' : '#ECECEC',
                          color: rider.attendanceStatus === 'ATTENDED' ? 'var(--green)' : rider.attendanceStatus === 'NO_SHOW' ? 'var(--red)' : '#777'
                        }}
                      >
                        {rider.attendanceStatus === 'ATTENDED' ? 'Hadir' : rider.attendanceStatus === 'NO_SHOW' ? 'Tidak Hadir' : 'Belum Dicatat'}
                      </span>
                    </div>

                    {/* Horse Assignment Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed #E5E5E5', paddingTop: '8px', marginTop: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: rider.horseName ? 'var(--ink)' : 'var(--muted)' }}>
                        <span style={{ fontWeight: rider.horseName ? 600 : 400 }}>
                          {rider.horseName ? `Kuda: ${rider.horseName}` : 'Belum ada kuda'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setHorseAssignModal({
                            participantId: rider.id,
                            riderName: rider.name,
                            currentHorseId: rider.horseId || null
                          });
                        }}
                        style={{
                          background: '#FFF',
                          border: '1px solid var(--line)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#8C6E2D',
                          cursor: 'pointer'
                        }}
                      >
                        {rider.horseName ? 'Ganti Kuda' : '+ Assign Kuda'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  {selectedPastSession.names}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                href={`/admin/schedule/${selectedPastSession.id}`}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  background: 'var(--ink)', color: '#FFF', textDecoration: 'none',
                  fontSize: '13px', fontWeight: 600, textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                Lihat Sesi Penuh
              </Link>
              <button
                type="button"
                onClick={() => setSelectedPastSession(null)}
                style={{
                  padding: '12px 18px', borderRadius: '12px',
                  border: '1px solid var(--line)', background: '#F9F9F9',
                  color: 'var(--muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
