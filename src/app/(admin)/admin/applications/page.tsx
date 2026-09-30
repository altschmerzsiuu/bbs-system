'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Calendar, Star, CheckCircle, XCircle, UploadCloud } from 'lucide-react';

type TabType = 'all' | 'reschedule' | 'membership';

export default function AdminReviewRequestsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Hardcoded mock state
  const [requests, setRequests] = useState([
    { id: '2', type: 'reschedule' },
    { id: '3', type: 'membership' }
  ]);

  const handleAction = (id: string, message: string) => {
    setRequests(requests.filter(r => r.id !== id));
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const hasReschedule = requests.some(r => r.id === '2');
  const hasMembership = requests.some(r => r.id === '3');

  const showReschedule = activeTab === 'all' || activeTab === 'reschedule';
  const showMembership = activeTab === 'all' || activeTab === 'membership';

  return (
    <div style={{ padding: '24px', paddingBottom: '100px' }}>
      <div className="appbar">
        <Link href="/admin" className="iconbtn" style={{ textDecoration: 'none' }}>
          <ChevronLeft size={20} />
        </Link>
        <div className="titles">
          <h2>Approval</h2>
          <span>{requests.length} permintaan menunggu · rata-rata respon 2 jam</span>
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
          className={activeTab === 'reschedule' ? 'active' : ''} 
          onClick={() => setActiveTab('reschedule')}
        >
          Reschedule · {requests.filter(r => r.type === 'reschedule').length}
        </button>
        <button 
          className={activeTab === 'membership' ? 'active' : ''} 
          onClick={() => setActiveTab('membership')}
        >
          Membership · {requests.filter(r => r.type === 'membership').length}
        </button>
      </div>

      {requests.length > 0 ? (
        <p className="helper">
          Setiap kartu sudah berisi semua info yang kamu butuh untuk memutuskan — tidak perlu buka halaman lain.
        </p>
      ) : (
        <p className="helper" style={{ textAlign: 'center', marginTop: '60px' }}>
          Semua permintaan sudah selesai di-review! 🎉
        </p>
      )}

      {showReschedule && hasReschedule && (
        <div className="card" style={{ padding: '20px', borderRadius: '20px', background: '#FFF', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: '1px solid var(--line)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--blue)', background: '#E3F2FD', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
              <Calendar size={14} />
              Reschedule
            </div>
            <span className="hint">5 jam lalu</span>
          </div>
          
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' }}>
            <div className="avatar" style={{ background: '#F5F5F7', color: 'var(--ink)', width: '48px', height: '48px', fontSize: '15px' }}>SR</div>
            <div>
              <b style={{ fontSize: '15px', color: 'var(--ink)' }}>Sarah</b>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', fontWeight: 500 }}>Silver · sisa 3 sesi</div>
            </div>
          </div>
          
          <div style={{ background: '#FAFAFA', borderRadius: '12px', padding: '14px', marginBottom: '20px', border: '1px solid var(--line2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
              <span style={{ color: 'var(--muted)' }}>Jadwal awal</span>
              <b style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>20 Sep · 16:00</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
              <span style={{ color: 'var(--ink)', fontWeight: 500 }}>Jadwal baru</span>
              <b style={{ color: 'var(--blue)' }}>20 Sep · 17:00</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '10px', borderTop: '1px solid var(--line2)' }}>
              <span style={{ color: 'var(--muted)' }}>Status slot</span>
              <b style={{ color: 'var(--green)' }}>Tersedia</b>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn" 
              style={{ flex: 1, background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
              onClick={() => handleAction('2', 'Jadwal Sarah dipindah ke 17:00')}
            >
              <CheckCircle size={16} /> Setujui
            </button>
            <button 
              className="btn ghost" 
              style={{ flex: 1, color: 'var(--red)', background: 'var(--redSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
              onClick={() => handleAction('2', 'Permintaan ditolak')}
            >
              <XCircle size={16} /> Tolak
            </button>
          </div>
        </div>
      )}

      {showMembership && hasMembership && (
        <div className="card" style={{ padding: '20px', borderRadius: '20px', background: '#FFF', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B8860B', background: '#FFF8DC', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
              <Star size={14} />
              Membership
            </div>
            <span className="hint">Kemarin</span>
          </div>
          
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' }}>
            <div className="avatar" style={{ background: '#FFF8DC', color: '#B8860B', width: '48px', height: '48px', fontSize: '15px' }}>AP</div>
            <div>
              <b style={{ fontSize: '15px', color: 'var(--ink)' }}>Andi Pratama</b>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', fontWeight: 500 }}>Perpanjangan Paket</div>
            </div>
          </div>
          
          <div style={{ background: '#FAFAFA', borderRadius: '12px', padding: '14px', marginBottom: '20px', border: '1px solid var(--line2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
              <span style={{ color: 'var(--muted)' }}>Paket</span>
              <b style={{ color: 'var(--gold)' }}>Gold (10 Sesi)</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '10px', borderTop: '1px solid var(--line2)' }}>
              <span style={{ color: 'var(--muted)' }}>Pembayaran</span>
              <b style={{ color: 'var(--amber)' }}>Menunggu Konfirmasi</b>
            </div>
            
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed var(--line2)' }}>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--ink)', fontWeight: 600, marginBottom: '8px' }}>Lampirkan Bukti Transfer (Admin)</span>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', border: '1.5px dashed var(--line)', borderRadius: '12px', cursor: 'pointer', background: '#FFF', transition: '0.2s' }}>
                <UploadCloud size={20} style={{ color: 'var(--muted)', marginBottom: '8px' }} />
                <span style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
                  Tap untuk upload<br/>(Hanya gambar, max 2MB)
                </span>
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/webp" 
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (!file.type.startsWith('image/')) {
                        setToastMessage('Hanya file gambar yang diperbolehkan!');
                      } else if (file.size > 2 * 1024 * 1024) {
                        setToastMessage('Ukuran file maksimal 2MB!');
                      } else {
                        setToastMessage(`File ${file.name} (siap dikompres & diunggah)`);
                      }
                      setTimeout(() => setToastMessage(null), 3000);
                    }
                  }} 
                />
              </label>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn" 
              style={{ flex: 1, background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
              onClick={() => handleAction('3', 'Membership Andi diperpanjang')}
            >
              <CheckCircle size={16} /> Aktifkan
            </button>
            <button 
              className="btn ghost" 
              style={{ flex: 1, color: 'var(--red)', background: 'var(--redSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
              onClick={() => handleAction('3', 'Permintaan ditolak')}
            >
              <XCircle size={16} /> Tolak
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: '#fff', padding: '12px 20px',
          borderRadius: '16px', fontSize: '12px', fontWeight: 600, zIndex: 100,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', whiteSpace: 'nowrap'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
