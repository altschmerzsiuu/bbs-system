
"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';

export default function AdminMemberDetailClient({ member }: { member: any }) {
  const [popup, setPopup] = useState<'kehadiran' | 'kontak' | 'bukti' | null>(null);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [activeView, setActiveView] = useState<'detail' | 'membership'>('detail');

  const name = member.full_name;
  const phone = member.phone || '';
  const email = member.users?.email || '';
  const emergencyName = member.emergency_contact_name || 'Tidak ada data';
  const emergencyPhone = member.emergency_contact_phone || '-';

  const activeMembership = member.memberships?.find((ms: any) => ms.status === 'ACTIVE');
  const planName = activeMembership?.membership_plans?.name || 'Basic Member';
  const allocatedCredits = activeMembership?.allocated_credits || 10;
  
  // Dummy values for now based on user instruction "buat dummy aja dulu kek tambah sesi aja gitu"
  const usedCredits = member.totalSessions > 0 ? member.totalSessions : 3;
  const remainingCredits = Math.max(0, allocatedCredits - usedCredits);
  
  let tier = 'basic';
  if (planName.toLowerCase().includes('gold')) tier = 'gold';
  else if (planName.toLowerCase().includes('silver')) tier = 'silver';

  const tierColors: Record<string, any> = {
    gold: { text: '#C99A4B', bg: 'rgba(201, 154, 75, 0.15)', fill: '#C99A4B', cardBg: 'linear-gradient(135deg, rgba(201, 154, 75, 0.25) 0%, rgba(201, 154, 75, 0.03) 100%)', buttonBg: 'rgba(201, 154, 75, 0.15)', buttonText: '#C99A4B' },
    silver: { text: '#7E8A96', bg: 'rgba(126, 138, 150, 0.15)', fill: '#7E8A96', cardBg: 'linear-gradient(135deg, rgba(126, 138, 150, 0.25) 0%, rgba(126, 138, 150, 0.03) 100%)', buttonBg: 'rgba(126, 138, 150, 0.15)', buttonText: '#7E8A96' },
    basic: { text: 'var(--ink)', bg: 'rgba(0,0,0,0.05)', fill: 'var(--ink)', cardBg: '#FFF', buttonBg: 'rgba(100, 136, 192, 0.1)', buttonText: '#6488C0' },
  };

  const currentTierColors = tierColors[tier];
  
  const formatDate = (dateString: string) => {
      if (!dateString) return '-';
      return new Intl.DateTimeFormat('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
      }).format(new Date(dateString));
  };
  
  const formatTime = (timeString: string) => {
      if (!timeString) return '';
      return timeString.substring(0, 5);
  };
  
  const formatMonth = (dateString: string) => {
      return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(dateString)).toUpperCase();
  };

  const formatDay = (dateString: string) => {
      return new Intl.DateTimeFormat('id-ID', { day: '2-digit' }).format(new Date(dateString));
  };

  const riwayatSesi = member.riwayatSesi || [];
  const displayHistory = showAllHistory ? riwayatSesi : riwayatSesi.slice(0, 3);

  const emergencyMessage = encodeURIComponent(`Halo ${emergencyName}, ini dari admin Borneo Berkuda Stable (BBS). Kami ingin mengabarkan tentang ${name}...`);

  const mockPayments = [
    { id: '1', date: '20 Sep 2026', package: 'Gold (10 Sesi)', price: 'Rp 2.500.000', method: 'BCA Transfer', status: 'Lunas' },
    { id: '2', date: '20 Jun 2026', package: 'Silver (5 Sesi)', price: 'Rp 1.500.000', method: 'Qris', status: 'Lunas' }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: '40px' }}>
      {/* 1. Appbar */}
      <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <Link href="/admin/members" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#fff', color: 'var(--ink)', border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0, textDecoration: 'none', marginTop: '2px' }}>
          <ChevronLeft size={22} strokeWidth={2.5} />
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 600, margin: 0, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{name}</h1>
          <span style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '8px' }}>
            {email} {email && phone ? '·' : ''} {phone}
          </span>
        </div>
      </div>

      <div style={{ padding: '0 20px 24px', display: 'flex', gap: '8px', flexDirection: 'row', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <button 
          onClick={() => setActiveView('detail')}
          style={{ padding: '8px 16px', borderRadius: '24px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', background: activeView === 'detail' ? 'var(--ink)' : 'rgba(0,0,0,0.05)', color: activeView === 'detail' ? '#FFF' : 'var(--ink)', whiteSpace: 'nowrap' }}
        >
          Detail Member
        </button>
        <button 
          onClick={() => setActiveView('membership')}
          style={{ padding: '8px 16px', borderRadius: '24px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', background: activeView === 'membership' ? 'var(--ink)' : 'rgba(0,0,0,0.05)', color: activeView === 'membership' ? '#FFF' : 'var(--ink)', whiteSpace: 'nowrap' }}
        >
          Riwayat Membership
        </button>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        {activeView === 'detail' && (
          <>
            {/* Card 1: Membership Info */}
            <div className="card" style={{ padding: '24px', marginBottom: '24px', background: currentTierColors.cardBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ background: currentTierColors.bg, color: currentTierColors.text, padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
              {planName}
            </span>
            {activeMembership && (
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Berlaku s/d {formatDate(activeMembership.end_date)}
              </span>
            )}
          </div>
          
          <div style={{ marginBottom: '20px' }}>
              <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ width: `${Math.min(100, (remainingCredits / allocatedCredits) * 100)}%`, height: '100%', background: currentTierColors.fill, borderRadius: '4px' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--muted)' }}>{remainingCredits} dari {allocatedCredits} sesi tersisa</span>
                  <span style={{ color: 'var(--muted)' }}>{usedCredits} terpakai</span>
              </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, "_blank")}
              style={{ flex: 1, padding: '14px 0', borderRadius: '16px', background: 'var(--ink)', color: 'var(--white)', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              Chat WhatsApp
            </button>
          </div>
        </div>

        {/* Card 2: Ringkasan */}
        <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '24px', marginTop: 0 }}>Ringkasan</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '16px' }}>
                <span style={{ color: 'var(--muted)' }}>Bergabung</span>
                <span style={{ fontWeight: 600 }}>{formatDate(member.created_at)}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '16px' }}>
                <span style={{ color: 'var(--muted)' }}>Total sesi</span>
                <span style={{ fontWeight: 600 }}>{member.totalSessions} sesi</span>
              </div>
              
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '16px', cursor: 'pointer' }}
                onClick={() => setPopup('kehadiran')}
              >
                <span style={{ color: 'var(--muted)' }}>Kehadiran</span>
                <span style={{ fontWeight: 600 }}>{member.attendanceRate}%</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                <span style={{ color: 'var(--muted)' }}>Kontak darurat</span>
                <span 
                    onClick={() => {
                        if (emergencyPhone && emergencyPhone !== '-') {
                            window.open(`https://wa.me/${emergencyPhone.replace(/[^0-9]/g, '')}?text=${emergencyMessage}`, "_blank");
                        }
                    }}
                    style={{ fontWeight: 600, cursor: 'pointer' }}
                >
                    {emergencyName} · {emergencyPhone}
                </span>
              </div>
          </div>
        </div>

        {/* Section 3: Riwayat sesi */}
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>Riwayat sesi</h3>
                {!showAllHistory && riwayatSesi.length > 3 && (
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>3 terakhir</span>
                )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayHistory.map((sesi: any) => (
                    <div key={sesi.id} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 600, lineHeight: 1 }}>{formatDay(sesi.date)}</span>
                            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginTop: '4px' }}>{formatMonth(sesi.date)}</span>
                        </div>
                        
                        <div style={{ flex: 1, borderLeft: '1px solid rgba(0,0,0,0.06)', paddingLeft: '20px' }}>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                                {formatTime(sesi.startTime)} — {formatTime(sesi.endTime)}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                                {sesi.arena} · {sesi.horse}
                            </div>
                        </div>
                        
                        <div>
                            <span style={{ 
                                padding: '6px 12px', 
                                borderRadius: '12px', 
                                fontSize: '12px', 
                                fontWeight: 600,
                                background: sesi.status === 'Selesai' ? 'rgba(100, 136, 192, 0.1)' : 'rgba(36, 114, 60, 0.1)',
                                color: sesi.status === 'Selesai' ? '#6488C0' : '#24723C'
                            }}>
                                {sesi.status}
                            </span>
                        </div>
                    </div>
                ))}
                
                {riwayatSesi.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px', background: 'transparent', border: '1px dashed rgba(0,0,0,0.1)', borderRadius: '24px' }}>
                        Belum ada riwayat sesi
                    </div>
                )}
            </div>
            
            {!showAllHistory && riwayatSesi.length > 3 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                    <button 
                        onClick={() => setShowAllHistory(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '8px 16px' }}
                    >
                        Tampilkan Lebih Banyak <ChevronDown size={16} />
                    </button>
                </div>
            )}
        </div>
        </>
        )}

        {activeView === 'membership' && (
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 16px' }}>Riwayat Pembayaran</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mockPayments.map(payment => (
                <div key={payment.id} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{payment.date}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--green)', background: 'rgba(36, 114, 60, 0.1)', padding: '4px 10px', borderRadius: '8px' }}>{payment.status}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Paket</span>
                      <b style={{ color: 'var(--ink)' }}>{payment.package}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Nominal</span>
                      <b style={{ color: 'var(--ink)' }}>{payment.price}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Metode Pembayaran</span>
                      <span style={{ color: 'var(--ink)' }}>{payment.method}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedProof('https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&q=80&w=400&h=600');
                      setPopup('bukti');
                    }}
                    style={{ width: '100%', padding: '16px', marginTop: '16px', background: 'var(--bg)', color: 'var(--ink)', fontSize: '14px', fontWeight: 600, border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px', cursor: 'pointer', transition: '0.2s' }}>
                    Lihat Bukti Transfer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Kehadiran Modal */}
      {popup === 'kehadiran' && (
          <div onClick={(e) => { if(e.target === e.currentTarget) setPopup(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: '#FFF', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 700 }}>Detail Kehadiran</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Total Sesi Diikuti</span>
                          <span style={{ fontWeight: 600 }}>{member.totalSessions}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Persentase Kehadiran</span>
                          <span style={{ fontWeight: 600 }}>{member.attendanceRate}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--muted)' }}>Total No-Show</span>
                          <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{member.noShowCount}</span>
                      </div>
                  </div>
                  <button 
                    onClick={() => setPopup(null)}
                    style={{ width: '100%', marginTop: '24px', padding: '14px', background: '#f1f5f9', color: 'var(--ink)', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                  >
                      Tutup
                  </button>
              </div>
          </div>
      )}

      {/* Modal Bukti Pembayaran */}
      {popup === 'bukti' && selectedProof && (
          <div onClick={(e) => { if(e.target === e.currentTarget) setPopup(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: '#FFF', borderRadius: '24px', padding: '16px', width: '100%', maxWidth: '360px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Bukti Pembayaran</h3>
                      <button onClick={() => setPopup(null)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <X size={18} />
                      </button>
                  </div>
                  <div style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', background: '#f1f5f9', display: 'flex', justifyContent: 'center' }}>
                      <img src={selectedProof} alt="Bukti Transfer" style={{ width: '100%', maxHeight: '500px', objectFit: 'contain' }} />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
