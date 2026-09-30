'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Calendar, Star, CheckCircle, XCircle, User, MessageCircle, Loader2 } from 'lucide-react';
import { approveRidingRequestAction, rejectRidingRequestAction } from '@/app/(admin)/admin/schedule/actions';
import { rejectApplicationAction, activateMembershipAction } from './actions';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { useRouter } from 'next/navigation';

type TabType = 'all' | 'riding' | 'membership';

export default function AdminReviewRequestsClient({ initialRequests }: { initialRequests: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);
  
  // Date/Time modal state
  const [assignModalReqId, setAssignModalReqId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedCapacity, setSelectedCapacity] = useState<number>(2);

  const handleApproveRiding = async (reqId: string) => {
    if (!selectedDate || !selectedTime) {
      toast.custom((t) => <AlertToast title="Error" description="Tanggal dan waktu harus diisi" variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      return;
    }
    
    setIsSubmittingId(reqId);
    const res = await approveRidingRequestAction(reqId, selectedDate, selectedTime + ':00', selectedCapacity);
    setIsSubmittingId(null);
    
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Request disetujui dan jadwal dibuat" onDismiss={() => toast.dismiss(t)} />);
      setAssignModalReqId(null);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const handleWA = (name: string, phone: string, type: string) => {
    if (!phone) {
      toast.custom((t) => <AlertToast variant="destructive" title="Gagal" description="Nomor HP tidak tersedia" onDismiss={() => toast.dismiss(t as string | number)} />);
      return;
    }
    const message = encodeURIComponent(`Halo ${name}, dari Admin BBS. Terkait permohonan jadwal ${type === 'JOY_RIDE' ? 'Joy Ride' : 'Casual Ride'} Anda...`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleRejectRiding = async (reqId: string) => {
    if (!confirm('Apakah Anda yakin ingin menolak request ini?')) return;
    setIsSubmittingId(reqId);
    const res = await rejectRidingRequestAction(reqId);
    setIsSubmittingId(null);
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Request ditolak" onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const formatDateBig = (dString: string) => {
    const d = new Date(dString);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const requests = initialRequests;
  const ridingRequests = requests.filter(r => r.category === 'riding');
  const membershipRequests = requests.filter(r => r.category === 'membership');

  const filteredRequests = activeTab === 'all' ? requests : requests.filter(r => r.category === activeTab);

  return (
    <div style={{ padding: '24px', paddingBottom: '100px' }}>
      <div className="appbar">
        <Link href="/admin" className="iconbtn" style={{ textDecoration: 'none' }}>
          <ChevronLeft size={20} />
        </Link>
        <div className="titles">
          <h2>Inbox Request</h2>
          <span>{requests.length} permohonan menunggu</span>
        </div>
      </div>

      <div className="tabs" data-tabgroup>
        <button 
          className={activeTab === 'all' ? 'active' : ''} 
          onClick={() => setActiveTab('all')}
        >
          Semua · {requests.length}
        </button>
        <button 
          className={activeTab === 'riding' ? 'active' : ''} 
          onClick={() => setActiveTab('riding')}
        >
          Riding · {ridingRequests.length}
        </button>
        <button 
          className={activeTab === 'membership' ? 'active' : ''} 
          onClick={() => setActiveTab('membership')}
        >
          Membership · {membershipRequests.length}
        </button>
      </div>

      {filteredRequests.length > 0 ? (
        <p className="helper">
          Pilih request untuk disetujui atau hubungi via WhatsApp.
        </p>
      ) : (
        <p className="helper" style={{ textAlign: 'center', marginTop: '60px' }}>
          Tidak ada permintaan pending! 🎉
        </p>
      )}

      {filteredRequests.map(req => {
        if (req.category === 'riding') {
          return (
            <div key={req.id} className="card" style={{ padding: '20px', borderRadius: '20px', background: '#FFF', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: '1px solid var(--line)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1B4B6B', background: '#E5F0F9', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                  <Calendar size={14} />
                  {req.type === 'JOY_RIDE' ? 'Joy Ride' : 'Casual Ride'}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '20px' }}>
                {req.memberAvatarUrl ? (
                  <img src={req.memberAvatarUrl} alt={req.memberName} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div className="avatar" style={{ background: '#F5F5F7', color: 'var(--ink)', width: '48px', height: '48px', fontSize: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={20} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: '15px', color: 'var(--ink)' }}>{req.memberName}</b>
                  <div 
                    onClick={() => {
                      if (req.memberEmail) {
                        navigator.clipboard.writeText(req.memberEmail);
                        toast.custom((t) => <AlertToast title="Disalin" description="Email disalin ke clipboard" onDismiss={() => toast.dismiss(t)} />);
                      }
                    }}
                    style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', fontWeight: 500, marginBottom: '8px', cursor: 'pointer' }}
                  >
                    {req.memberEmail || '-'}
                  </div>
                  
                  {req.heightCm && req.weightKg && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#FDFBF7', padding: '16px', borderRadius: '12px', border: '1px solid #EBE4D5' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.025em' }}>
                        {formatDateBig(req.createdAt)}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 30%', minWidth: '70px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', fontWeight: 700 }}>Tinggi</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{req.heightCm} cm</div>
                        </div>
                        <div style={{ flex: '1 1 30%', minWidth: '70px' }}>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', fontWeight: 700 }}>Berat</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{req.weightKg} kg</div>
                        </div>
                        {req.shoeSize && (
                          <div style={{ flex: '1 1 30%', minWidth: '70px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', fontWeight: 700 }}>Sepatu</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{req.shoeSize}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn" 
                    style={{ flex: 1, background: '#25D366', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
                    onClick={() => handleWA(req.memberName, req.memberPhone, req.type)}
                  >
                    <MessageCircle size={16} /> WA
                  </button>
                  <button 
                    className="btn" 
                    style={{ flex: 1, background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
                    onClick={() => {
                      setAssignModalReqId(req.id);
                      // Default to today and 15:00
                      const today = new Date();
                      setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
                      setSelectedTime('15:00');
                    }}
                  >
                    <CheckCircle size={16} /> Tetapkan Jadwal
                  </button>
                </div>
                <button
                  className="btn"
                  onClick={() => handleRejectRiding(req.id)}
                  disabled={isSubmittingId === req.id}
                  style={{ width: '100%', background: '#FFF', color: 'var(--red)', border: '1px solid var(--redSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {isSubmittingId === req.id ? <Loader2 size={16} className="spin" /> : <XCircle size={16} />} Tolak
                </button>
              </div>
            </div>
          );
        }

        // Membership UI remains dummy for now
        return (
          <div key={req.id} className="card" style={{ padding: '20px', borderRadius: '20px', background: '#FFF', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: '1px solid var(--line)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B8860B', background: '#FFF8DC', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                <Star size={14} />
                Membership
              </div>
              <span className="hint">{new Date(req.createdAt).toLocaleDateString('id-ID')}</span>
            </div>
            
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' }}>
              {req.memberAvatarUrl ? (
                <img src={req.memberAvatarUrl} alt={req.memberName} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div className="avatar" style={{ background: '#FFF8DC', color: '#B8860B', width: '48px', height: '48px', fontSize: '15px' }}>
                  <User size={20} />
                </div>
              )}
              <div>
                <b style={{ fontSize: '15px', color: 'var(--ink)' }}>{req.memberName}</b>
                <div 
                  onClick={() => {
                    if (req.memberEmail) {
                      navigator.clipboard.writeText(req.memberEmail);
                      toast.custom((t) => <AlertToast title="Disalin" description="Email disalin ke clipboard" onDismiss={() => toast.dismiss(t)} />);
                    }
                  }}
                  style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', fontWeight: 500, cursor: 'pointer' }}
                >
                  {req.memberEmail || '-'}
                </div>
              </div>
            </div>
            
            <div style={{ background: '#FAFAFA', borderRadius: '12px', padding: '14px', marginBottom: '20px', border: '1px solid var(--line2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: 'var(--muted)' }}>Paket</span>
                <b style={{ color: 'var(--gold)' }}>{req.planName}</b>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn" 
                style={{ flex: 1, background: '#FFF', color: 'var(--red)', border: '1px solid var(--redSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
                onClick={async () => {
                  if (confirm('Yakin ingin menolak aplikasi ini?')) {
                    setIsSubmittingId(req.id);
                    await rejectApplicationAction(req.id);
                    setIsSubmittingId(null);
                  }
                }}
                disabled={isSubmittingId === req.id}
              >
                <XCircle size={16} /> Tolak
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
                onClick={async () => {
                  setIsSubmittingId(req.id);
                  await activateMembershipAction(req.id);
                  setIsSubmittingId(null);
                  toast.custom((t) => <AlertToast title="Berhasil" description="Membership diaktifkan." onDismiss={() => toast.dismiss(t)} />);
                }}
                disabled={isSubmittingId === req.id}
              >
                {isSubmittingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} 
                Aktifkan
              </button>
            </div>
          </div>
        );
      })}

      {assignModalReqId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={(e) => { if (e.target === e.currentTarget) setAssignModalReqId(null); }}>
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Tetapkan Jadwal</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>Tanggal</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={e => setSelectedDate(e.target.value)} 
                    style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #EBE4D5', background: '#FDFBF7', outline: 'none', color: 'var(--ink)', fontWeight: 500 }} 
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>Waktu Sesi</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {['07:00', '08:00', '09:00', '10:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                    <div
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        borderRadius: '10px',
                        border: selectedTime === time ? '2px solid var(--ink)' : '1px solid #EBE4D5',
                        background: selectedTime === time ? 'var(--ink)' : '#FDFBF7',
                        color: selectedTime === time ? '#FFF' : 'var(--ink)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {time}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setAssignModalReqId(null)}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#F5F5F5', color: 'var(--ink)', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button 
                onClick={() => handleApproveRiding(assignModalReqId)}
                disabled={isSubmittingId === assignModalReqId || !selectedDate || !selectedTime}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'var(--ink)', color: '#FFF', border: 'none', fontWeight: 600, cursor: (!selectedDate || !selectedTime || isSubmittingId === assignModalReqId) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (!selectedDate || !selectedTime) ? 0.5 : 1 }}
              >
                {isSubmittingId === assignModalReqId && <Loader2 size={16} className="spin" />}
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
