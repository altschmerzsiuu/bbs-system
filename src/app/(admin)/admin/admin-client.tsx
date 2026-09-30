'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resolveAttendanceAction } from './schedule/actions';
import {
  Bell, Plus, MinusCircle, FileCheck, FileBarChart, Clock, ChevronRight, Hourglass, Calendar, AlertTriangle, Send, Search, Check, MessageCircle, X, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import type {
  AdminHomeStats, PendingRequestSummary, UpcomingSession, CurrentSession
} from '@/modules/admin/admin-home-queries';

interface AdminClientProps {
  stats: AdminHomeStats;
  pending: PendingRequestSummary;
  upcoming: UpcomingSession[];
  currentSession: CurrentSession | null;
  pastSessions?: UpcomingSession[];
  followUps?: any[];
  todayStr: string;
  adminName: string;
}

export function AdminClient({ stats, pending, upcoming, currentSession, pastSessions = [], followUps = [], todayStr, adminName }: AdminClientProps) {
  const router = useRouter();
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState<string | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [dismissedFollowUps, setDismissedFollowUps] = useState<string[]>([]);
  const [visibleFollowUps, setVisibleFollowUps] = useState(2);
  const [confirmNoShow, setConfirmNoShow] = useState<{riderId: string, name: string} | null>(null);

  // --- MOCK DATA INJECTION FOR UI REVIEW ---
  followUps = [
    { id: 'm0', icon: 'Calendar', title: 'Reschedule: Andi Setiawan', subtitle: 'Meminta pindah ke besok 16:00', actionText: 'Cek', actionIcon: 'Search', urgency: 'red' },
    { id: 'm1', icon: 'Hourglass', title: 'Sarah - Membership paket Silver akan habis dalam 2 hari', subtitle: 'Sisa 3 sesi · Terakhir aktif 25 Sep', actionText: 'Chat', actionIcon: 'MessageCircle', urgency: 'orange' },
    { id: 'm2', icon: 'AlertTriangle', title: 'Pembayaran booking sesi 19:00 belum dikonfirmasi', subtitle: 'Budi Santoso · Bukti transfer belum diunggah', actionText: 'Cek', actionIcon: 'Search', urgency: 'orange' },
    { id: 's1', icon: 'Calendar', title: 'Sesi besok pagi jam 07:00 & 08:00 masih kosong', subtitle: 'Tawarkan ke member yang aktif pagi hari', actionText: 'Info', actionIcon: 'Send', urgency: 'blue' }
  ];

  upcoming = [
    { id: 'u1', time: '18:00', duration: 45, riders: 1, arena: 'Arena 01', names: 'Budi Santoso', status: 'Ready', rawTime: '' },
    { id: 'u2', time: '19:00', duration: 45, riders: 2, arena: 'Arena 01', names: 'Dimas, Rina', status: 'Ready', rawTime: '' }
  ];

  currentSession = {
    id: 'c1',
    timeRange: '17:00 — 17:45',
    arena: 'Arena 01',
    progressPercent: 60,
    elapsedText: '27 menit berjalan',
    remainingText: 'sisa 18 menit',
    riders: [
      { id: 'r1', init: 'KA', name: 'Keisha Alviani', attendanceStatus: 'NOT_CHECKED_IN' },
      { id: 'r2', init: 'AR', name: 'Arsyi Aditama', attendanceStatus: 'ATTENDED' }
    ]
  };

  pastSessions = [
    { id: 'p1', time: '15:00', duration: 45, riders: 2, arena: 'Arena 01', names: 'Joko, Anwar', status: 'Completed', rawTime: '' },
    { id: 'p2', time: '14:00', duration: 45, riders: 1, arena: 'Arena 01', names: 'Siti', status: 'Completed', rawTime: '' }
  ];
  // --- END MOCK DATA ---

  // Background auto-refresh for near real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [router]);

  const handleMarkAttendance = async (participantId: string, status: 'ATTENDED' | 'NO_SHOW') => {
    setIsUpdatingAttendance(participantId);
    try {
      const res = await resolveAttendanceAction(participantId, status, 'CONSUMED');
      if (res && res.ok) {
        toast.custom((t) => <AlertToast title="Berhasil" description="Absensi berhasil disimpan." onDismiss={() => toast.dismiss(t)} />);
        router.refresh();
      } else {
        toast.custom((t) => <AlertToast title="Gagal" description={res?.message || 'Gagal menyimpan absensi.'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      }
    } catch (e) {
      console.error(e);
      toast.custom((t) => <AlertToast title="Error" description="Terjadi kesalahan yang tidak terduga." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    } finally {
      setIsUpdatingAttendance(null);
    }
  };

  return (
    <>
      <div className="appbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/admin/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="avatar" style={{ cursor: 'pointer' }}>{adminName.substring(0, 2).toUpperCase()}</div>
          </Link>
          <div className="titles" style={{ display: 'flex', flexDirection: 'column' }}>
            <b style={{ fontSize: '15px' }}>
              Halo, {adminName}
            </b>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
              {todayStr} | Admin
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/admin/settings" className="iconbtn" title="Settings Kandang" style={{ color: 'inherit' }}>
            <Settings size={17} strokeWidth={2} />
          </Link>
          <Link href="/admin/applications" className="iconbtn" title="Notifications" style={{ color: 'inherit', position: 'relative' }}>
            {pending.total > 0 && <span className="dot" style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: 'var(--red)', borderRadius: '50%' }}></span>}
            <Bell size={17} strokeWidth={2} />
          </Link>
        </div>
      </div>

      <div className="attention" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '20px' }}>
        <div>
          <span className="eyebrow" style={{ color: 'var(--goldSoft)' }}>Perlu keputusan kamu</span>
          <div className="big" style={{ fontSize: '24px', margin: '4px 0 0', lineHeight: 1.2 }}>{pending.reschedule + pending.membership} permintaan<br />menunggu approval</div>
        </div>

        <div className="statgrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <div className="stat" style={{ textAlign: 'left', padding: '14px 12px', background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', color: '#FFF', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}>
            <strong style={{ fontSize: '26px', color: '#FFF', fontWeight: 800 }}>{pending.reschedule}</strong>
            <span style={{ color: 'rgba(255,255,255,0.75)', marginTop: '6px', fontSize: '11px', fontWeight: 500, letterSpacing: '0.2px' }}>Reschedule</span>
          </div>
          <div className="stat" style={{ textAlign: 'left', padding: '14px 12px', background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', color: '#FFF', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}>
            <strong style={{ fontSize: '26px', color: '#FFF', fontWeight: 800 }}>{pending.membership}</strong>
            <span style={{ color: 'rgba(255,255,255,0.75)', marginTop: '6px', fontSize: '11px', fontWeight: 500, letterSpacing: '0.2px' }}>Membership</span>
          </div>
          <div className="stat" style={{ textAlign: 'left', padding: '14px 12px', background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', color: '#FFF', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}>
            <strong style={{ fontSize: '26px', color: '#FFF', fontWeight: 800 }}>{stats.sessions}</strong>
            <span style={{ color: 'rgba(255,255,255,0.75)', marginTop: '6px', fontSize: '11px', fontWeight: 500, letterSpacing: '0.2px' }}>Sesi hari ini</span>
          </div>
        </div>

        <Link
          href="/admin/applications"
          className="btn gold"
          style={{ position: 'relative', zIndex: 2, textDecoration: 'none', display: 'flex', justifyContent: 'center', color: 'var(--ink)' }}
        >
          Review Sekarang
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
                          className="btn soft sm" 
                          style={{ padding: '6px 14px', background: 'var(--accentSoft)', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, width: 'fit-content', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }}
                        >
                          {item.actionIcon === 'MessageCircle' ? <MessageCircle size={14} /> : item.actionIcon === 'Search' ? <Search size={14} /> : item.actionIcon === 'Send' ? <Send size={14} /> : null}
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

      {upcoming && upcoming.length > 0 && (
        <>
          <div className="sectionhead">
            <b>Berikutnya</b>
            <Link href="/admin/schedule" style={{ color: 'inherit', textDecoration: 'none' }}>Semua</Link>
          </div>
          <div className="rowlist">
            {upcoming.slice(0, 3).map(session => <Link key={session.id} href={`/admin/schedule/${session.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <b>{session.time}</b>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>{session.duration} MNT</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingLeft: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {session.names.split(', ').slice(0, 3).map((name, idx) => (
                      <div key={idx} style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'var(--accent)', color: '#FFF', display: 'grid', placeItems: 'center',
                        fontSize: '10px', fontWeight: 700, border: '2px solid var(--paper)',
                        marginLeft: idx > 0 ? '-10px' : '0', zIndex: 3 - idx
                      }}>
                        {name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
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
                    <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{session.names}</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--muted)" />
            </Link>)}
          </div>
        </>
      )}

      {currentSession && (
        <>
          <div className="sectionhead">
            <b>Sedang berjalan</b>
            <Link href="/admin/schedule" style={{ color: 'inherit', textDecoration: 'none' }}>Lihat jadwal</Link>
          </div>
          <div className="card">
            <div className="cardhead">
              <b>{currentSession.timeRange}</b>
              <span className="pill ok" style={{ background: 'var(--greenSoft)', color: 'var(--green)' }}>Berlangsung</span>
            </div>
            <div className="who" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentSession.riders.length === 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>Sesi Kosong / Tidak ada jadwal</span>
              ) : (
                currentSession.riders.map(rider => (
                  <div 
                    key={rider.id} 
                    onClick={() => {
                      if (rider.attendanceStatus === 'NOT_CHECKED_IN') {
                        setSelectedRiderId(selectedRiderId === rider.id ? null : rider.id);
                      }
                    }}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      padding: '8px 0', borderBottom: '1px solid var(--line)',
                      cursor: rider.attendanceStatus === 'NOT_CHECKED_IN' ? 'pointer' : 'default',
                      opacity: rider.attendanceStatus === 'NOT_CHECKED_IN' ? 1 : 0.6
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {rider.attendanceStatus === 'NOT_CHECKED_IN' ? (
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: selectedRiderId === rider.id ? 'var(--ink)' : 'var(--paper)',
                          border: selectedRiderId === rider.id ? 'none' : '1px solid var(--muted)',
                          display: 'grid', placeItems: 'center', color: '#FFF'
                        }}>
                          {selectedRiderId === rider.id && <Check size={14} strokeWidth={3} />}
                        </div>
                      ) : (
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: 'var(--green)', color: '#FFF',
                          display: 'grid', placeItems: 'center'
                        }}>
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                      
                      <div className="avatar sm">{rider.init}</div>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{rider.name}</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px',
                        background: rider.attendanceStatus === 'NOT_CHECKED_IN' ? 'var(--paper)' : 'var(--greenSoft)',
                        color: rider.attendanceStatus === 'NOT_CHECKED_IN' ? 'var(--muted)' : 'var(--green)'
                      }}>
                        {rider.attendanceStatus === 'NOT_CHECKED_IN' ? 'Belum' : 'Hadir'}
                      </span>
                      <ChevronRight size={16} strokeWidth={2} color="var(--muted)" />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="meter" style={{ marginTop: '14px' }}>
              <i className="green" style={{ width: `${currentSession.progressPercent}%`, background: 'var(--green)' }}></i>
            </div>
            <div className="meterlabel">
              <span>{currentSession.elapsedText}</span>
              <span>{currentSession.remainingText}</span>
            </div>
            
            {/* Kept fallback if no rider is selected but there is only 1 rider, to maintain layout backward compatibility */}
            {!selectedRiderId && currentSession.riders.length === 1 && currentSession.riders[0].attendanceStatus === 'NOT_CHECKED_IN' && (
              <div className="btnrow" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                 <button
                    disabled={isUpdatingAttendance === currentSession.riders[0].id}
                    onClick={() => handleMarkAttendance(currentSession.riders[0].id, 'ATTENDED')}
                    style={{ background: 'var(--green)', color: '#FFF', flex: 1, border: 'none', fontWeight: 600, borderRadius: '20px', padding: '12px 0', fontSize: '14px', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}
                  >
                    {isUpdatingAttendance === currentSession.riders[0].id ? '...' : 'Hadir'}
                  </button>
                  <button
                    disabled={isUpdatingAttendance === currentSession.riders[0].id}
                    onClick={() => setConfirmNoShow({ riderId: currentSession.riders[0].id, name: currentSession.riders[0].name })}
                    style={{ background: 'var(--red)', color: '#FFF', flex: 1, border: 'none', fontWeight: 600, borderRadius: '20px', padding: '12px 0', fontSize: '14px', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}
                  >
                    {isUpdatingAttendance === currentSession.riders[0].id ? '...' : 'Tidak Hadir'}
                  </button>
              </div>
            )}
          </div>
          
          {/* Bottom Fixed Action Bar for selected rider */}
          {selectedRiderId && (() => {
            const rider = currentSession.riders.find(r => r.id === selectedRiderId);
            if (!rider) return null;
            return (
              <div style={{
                position: 'fixed', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
                width: 'calc(100% - 24px)', maxWidth: '456px', background: 'var(--ink)',
                borderRadius: '28px', height: '72px', padding: '0 8px', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', zIndex: 100,
                boxShadow: '0 18px 40px rgba(0,0,0,0.28)', gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
                  <div className="avatar sm" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF' }}>{rider.init}</div>
                  <span style={{ color: '#FFF', fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                    {rider.name.split(' ')[0]}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    disabled={isUpdatingAttendance === rider.id}
                    onClick={async () => {
                      await handleMarkAttendance(rider.id, 'ATTENDED');
                      setSelectedRiderId(null);
                    }}
                    style={{
                      background: '#FFF', color: 'var(--ink)', padding: '12px 24px',
                      borderRadius: '100px', border: 'none', fontWeight: 700, fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    {isUpdatingAttendance === rider.id ? '...' : 'Hadir'}
                  </button>
                  <button 
                    disabled={isUpdatingAttendance === rider.id}
                    onClick={() => {
                      setConfirmNoShow({ riderId: rider.id, name: rider.name });
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.1)', color: '#FFF', padding: '12px 20px',
                      borderRadius: '100px', border: 'none', fontWeight: 600, fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    {isUpdatingAttendance === rider.id ? '...' : 'Tidak Hadir'}
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {pastSessions && pastSessions.length > 0 && (
        <>
          <div className="sectionhead" style={{ marginTop: '32px' }}>
            <b>Riwayat sesi hari ini</b>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pastSessions.slice(0, 3).map(session => (
              <Link key={session.id} href={`/admin/schedule/${session.id}`} style={{ 
                textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', 
                justifyContent: 'space-between', padding: '12px 16px', background: 'var(--paper)',
                borderRadius: '16px', border: '1px solid var(--line)', opacity: 0.8
              }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <b style={{ fontSize: '15px', color: 'var(--muted)' }}>{session.time}</b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {session.names.split(', ').slice(0, 3).map((name, idx) => (
                        <div key={idx} style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          background: 'var(--line)', color: 'var(--muted)', display: 'grid', placeItems: 'center',
                          fontSize: '9px', fontWeight: 700, border: '2px solid var(--paper)',
                          marginLeft: idx > 0 ? '-10px' : '0', zIndex: 3 - idx
                        }}>
                          {name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                      <b style={{ fontSize: '13px' }}>{session.riders} Rider</b>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{session.names}</span>
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', background: 'var(--line)', padding: '4px 8px', borderRadius: '8px' }}>Selesai</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div style={{ height: '100px' }} />

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
                onClick={async () => {
                  const id = confirmNoShow.riderId;
                  setConfirmNoShow(null);
                  await handleMarkAttendance(id, 'NO_SHOW');
                  setSelectedRiderId(null);
                }}
                style={{ flex: 1, padding: '12px', borderRadius: '100px', border: 'none', background: 'var(--red)', color: '#FFF', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Ya, Tandai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
