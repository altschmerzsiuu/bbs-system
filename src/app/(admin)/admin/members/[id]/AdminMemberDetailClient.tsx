"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, X, Sparkles, ExternalLink, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

export default function AdminMemberDetailClient({ member }: { member: any }) {
  const [popup, setPopup] = useState<'kehadiran' | 'kontak' | 'bukti' | null>(null);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [activeView, setActiveView] = useState<'detail' | 'membership'>('detail');
  const [avatarError, setAvatarError] = useState(false);

  const name = member.full_name;
  const phone = member.phone || '';
  const email = member.users?.email || '';
  const avatarUrl = member.users?.avatar_url || '';
  const emergencyName = member.emergency_contact_name || 'Tidak ada data';
  const emergencyPhone = member.emergency_contact_phone || '-';

  const activeMembership = member.memberships?.find((ms: any) => ms.status === 'ACTIVE');
  const planName = activeMembership?.membership_plans?.name || 'Basic Member';
  
  // Real credit values from RPC / database passed from server
  const allocatedCredits = member.allocatedCredits ?? (activeMembership?.allocated_credits || 10);
  const remainingCredits = member.remainingCredits ?? Math.max(0, allocatedCredits - (member.usedCredits || 0));
  const usedCredits = member.usedCredits ?? 0;

  let tier: 'gold' | 'silver' | 'basic' = 'basic';
  if (planName.toLowerCase().includes('gold')) tier = 'gold';
  else if (planName.toLowerCase().includes('silver')) tier = 'silver';

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0].toUpperCase())
    .join('') || name.substring(0, 2).toUpperCase();

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
  const displayHistory = showAllHistory ? riwayatSesi : riwayatSesi.slice(0, 4);

  const emergencyMessage = encodeURIComponent(
    `Halo ${emergencyName}, ini dari admin Borneo Berkuda Stable (BBS). Kami ingin mengabarkan tentang ${name}...`
  );

  const payments = member.payments || [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', paddingBottom: '60px' }}>
      {/* 1. Appbar */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link
          href="/admin/members"
          style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: '#fff',
            color: 'var(--ink)',
            border: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0,
            textDecoration: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
          {/* Avatar with fallback */}
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: tier === 'gold' ? '#FEF3C7' : tier === 'silver' ? '#F1F5F9' : '#E2E8F0',
              color: tier === 'gold' ? '#B45309' : tier === 'silver' ? '#475569' : '#1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '18px',
              flexShrink: 0,
              overflow: 'hidden',
              border: '2px solid rgba(0,0,0,0.06)',
              boxShadow: '0 3px 10px rgba(0,0,0,0.04)'
            }}
          >
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt={name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <h1
              style={{
                fontSize: '21px',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                margin: 0,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {name}
            </h1>
            <span style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {email}{email && phone ? ' · ' : ''}{phone}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Slide Navbar (Segmented Control) */}
      <div style={{ padding: '0 20px 20px' }}>
        <div
          style={{
            background: '#EAE6DC',
            padding: '4px',
            borderRadius: '16px',
            display: 'flex',
            gap: '4px',
            position: 'relative',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <button
            onClick={() => setActiveView('detail')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '13.5px',
              fontWeight: activeView === 'detail' ? 700 : 600,
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'detail' ? '#FFFFFF' : 'transparent',
              color: activeView === 'detail' ? 'var(--ink)' : '#7C7667',
              boxShadow: activeView === 'detail' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>Detail Member</span>
          </button>
          <button
            onClick={() => setActiveView('membership')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '13.5px',
              fontWeight: activeView === 'membership' ? 700 : 600,
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'membership' ? '#FFFFFF' : 'transparent',
              color: activeView === 'membership' ? 'var(--ink)' : '#7C7667',
              boxShadow: activeView === 'membership' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>Riwayat Pembayaran</span>
            {payments.length > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '100px',
                  background: activeView === 'membership' ? '#EAE6DC' : '#DDD7CB',
                  color: 'var(--ink)'
                }}
              >
                {payments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        {activeView === 'detail' && (
          <>
            {/* Card 1: Luxury Membership Card */}
            {tier === 'gold' && (
              <div
                style={{
                  padding: '24px',
                  marginBottom: '24px',
                  borderRadius: '24px',
                  background: 'linear-gradient(145deg, #1C1914 0%, #2B2317 48%, #16130E 100%)',
                  border: '1px solid rgba(230, 195, 105, 0.35)',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2), 0 0 20px rgba(212, 175, 55, 0.1)',
                  color: '#FFFFFF',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Metallic shine effect */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-60px',
                    right: '-40px',
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(230, 195, 105, 0.2) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', position: 'relative' }}>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(230, 195, 105, 0.25) 0%, rgba(201, 154, 75, 0.1) 100%)',
                      color: '#F5E3B8',
                      padding: '6px 14px',
                      borderRadius: '100px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      letterSpacing: '0.6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      border: '1px solid rgba(230, 195, 105, 0.4)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                    }}
                  >
                    <Sparkles size={13} color="#F5E3B8" />
                    <span>GOLD PACKAGE</span>
                  </div>
                  {activeMembership && (
                    <span style={{ fontSize: '12px', color: '#D4C5A9', fontWeight: 500 }}>
                      Berlaku s/d <b style={{ color: '#F3E5AB' }}>{formatDate(activeMembership.end_date)}</b>
                    </span>
                  )}
                </div>

                {/* Quota Progress */}
                <div style={{ marginBottom: '22px', position: 'relative' }}>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.12)', borderRadius: '100px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: `${Math.min(100, (remainingCredits / Math.max(1, allocatedCredits)) * 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #D4AF37 0%, #F5E3B8 100%)',
                        borderRadius: '100px',
                        boxShadow: '0 0 10px rgba(245, 227, 184, 0.5)'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#F5E3B8', fontWeight: 700 }}>
                      {remainingCredits} dari {allocatedCredits} sesi tersisa
                    </span>
                    <span style={{ color: '#A89E8C' }}>
                      {usedCredits} terpakai / ter-booking
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                  <button
                    onClick={() => window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank')}
                    style={{
                      flex: 1,
                      padding: '13px 0',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #F3E5AB 0%, #D4AF37 100%)',
                      color: '#1A160F',
                      fontSize: '13.5px',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(212, 175, 55, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Chat WhatsApp Member
                  </button>
                </div>
              </div>
            )}

            {tier === 'silver' && (
              <div
                style={{
                  padding: '24px',
                  marginBottom: '24px',
                  borderRadius: '24px',
                  background: 'linear-gradient(145deg, #15181C 0%, #222930 48%, #111417 100%)',
                  border: '1px solid rgba(190, 205, 220, 0.35)',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2), 0 0 20px rgba(190, 205, 220, 0.1)',
                  color: '#FFFFFF',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-60px',
                    right: '-40px',
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(190, 205, 220, 0.18) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', position: 'relative' }}>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(200, 215, 230, 0.22) 0%, rgba(140, 160, 180, 0.1) 100%)',
                      color: '#E2E8F0',
                      padding: '6px 14px',
                      borderRadius: '100px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      letterSpacing: '0.6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      border: '1px solid rgba(200, 215, 230, 0.4)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                    }}
                  >
                    <span>◆ SILVER PACKAGE</span>
                  </div>
                  {activeMembership && (
                    <span style={{ fontSize: '12px', color: '#CBD5E1', fontWeight: 500 }}>
                      Berlaku s/d <b style={{ color: '#F1F5F9' }}>{formatDate(activeMembership.end_date)}</b>
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: '22px', position: 'relative' }}>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.12)', borderRadius: '100px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: `${Math.min(100, (remainingCredits / Math.max(1, allocatedCredits)) * 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #94A3B8 0%, #E2E8F0 100%)',
                        borderRadius: '100px',
                        boxShadow: '0 0 10px rgba(226, 232, 240, 0.5)'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#E2E8F0', fontWeight: 700 }}>
                      {remainingCredits} dari {allocatedCredits} sesi tersisa
                    </span>
                    <span style={{ color: '#94A3B8' }}>
                      {usedCredits} terpakai / ter-booking
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                  <button
                    onClick={() => window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank')}
                    style={{
                      flex: 1,
                      padding: '13px 0',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #F1F5F9 0%, #CBD5E1 100%)',
                      color: '#0F172A',
                      fontSize: '13.5px',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(200, 215, 230, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Chat WhatsApp Member
                  </button>
                </div>
              </div>
            )}

            {tier === 'basic' && (
              <div
                className="card"
                style={{
                  padding: '24px',
                  marginBottom: '24px',
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <span
                    style={{
                      background: 'rgba(0,0,0,0.06)',
                      color: 'var(--ink)',
                      padding: '5px 12px',
                      borderRadius: '100px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.4px'
                    }}
                  >
                    BASIC MEMBER
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Belum Berlangganan Paket</span>
                </div>
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--muted)' }}>Total Sesi Diikuti</span>
                    <b style={{ color: 'var(--ink)' }}>{member.totalSessions} sesi</b>
                  </div>
                </div>
                <button
                  onClick={() => window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank')}
                  style={{
                    width: '100%',
                    padding: '13px 0',
                    borderRadius: '14px',
                    background: 'var(--ink)',
                    color: '#FFF',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Chat WhatsApp Member
                </button>
              </div>
            )}

            {/* Card 2: Ringkasan */}
            <div className="card" style={{ padding: '24px', marginBottom: '28px', background: '#FFFFFF', borderRadius: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', marginTop: 0 }}>Ringkasan Aktivitas</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '14px' }}>
                  <span style={{ color: 'var(--muted)' }}>Bergabung</span>
                  <span style={{ fontWeight: 600 }}>{formatDate(member.created_at)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '14px' }}>
                  <span style={{ color: 'var(--muted)' }}>Total Sesi Selesai</span>
                  <span style={{ fontWeight: 600 }}>{member.totalSessions} sesi</span>
                </div>

                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '14px', cursor: 'pointer' }}
                  onClick={() => setPopup('kehadiran')}
                >
                  <span style={{ color: 'var(--muted)' }}>Tingkat Kehadiran</span>
                  <span style={{ fontWeight: 700, color: member.attendanceRate >= 80 ? 'var(--green)' : 'var(--ink)' }}>
                    {member.attendanceRate}%
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: 'var(--muted)' }}>Kontak Darurat</span>
                  <span
                    onClick={() => {
                      if (emergencyPhone && emergencyPhone !== '-') {
                        window.open(`https://wa.me/${emergencyPhone.replace(/[^0-9]/g, '')}?text=${emergencyMessage}`, '_blank');
                      }
                    }}
                    style={{ fontWeight: 600, cursor: emergencyPhone && emergencyPhone !== '-' ? 'pointer' : 'default', color: emergencyPhone && emergencyPhone !== '-' ? '#2563EB' : 'var(--ink)' }}
                  >
                    {emergencyName} · {emergencyPhone}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Riwayat sesi */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Riwayat Sesi Berkuda ({riwayatSesi.length})
                </h3>
                {!showAllHistory && riwayatSesi.length > 4 && (
                  <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>4 terbaru</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {displayHistory.map((sesi: any) => {
                  let badgeBg = '#F3F4F6';
                  let badgeColor = '#4B5563';

                  if (sesi.statusVariant === 'confirmed') {
                    badgeBg = '#DCFCE7';
                    badgeColor = '#15803D';
                  } else if (sesi.statusVariant === 'pending') {
                    badgeBg = '#FEF3C7';
                    badgeColor = '#B45309';
                  } else if (sesi.statusVariant === 'completed') {
                    badgeBg = '#E0F2FE';
                    badgeColor = '#0369A1';
                  } else if (sesi.statusVariant === 'cancelled') {
                    badgeBg = '#FEE2E2';
                    badgeColor = '#B91C1C';
                  }

                  return (
                    <div
                      key={sesi.id}
                      className="card"
                      style={{
                        padding: '18px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '18px',
                        background: '#FFFFFF',
                        borderRadius: '20px',
                        border: '1px solid rgba(0,0,0,0.05)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '44px', flexShrink: 0 }}>
                        <span style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>
                          {formatDay(sesi.date)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, marginTop: '3px' }}>
                          {formatMonth(sesi.date)}
                        </span>
                      </div>

                      <div style={{ flex: 1, borderLeft: '1px solid rgba(0,0,0,0.06)', paddingLeft: '18px', minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '3px' }}>
                          {formatTime(sesi.startTime)} — {formatTime(sesi.endTime)}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span>{sesi.arena}</span>
                          <span>·</span>
                          <span style={{ color: sesi.horse !== 'Belum di-assign' ? 'var(--ink)' : 'var(--muted)', fontWeight: sesi.horse !== 'Belum di-assign' ? 600 : 400 }}>
                            Kuda: {sesi.horse}
                          </span>
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        <span
                          style={{
                            padding: '6px 11px',
                            borderRadius: '100px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: badgeBg,
                            color: badgeColor,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {sesi.status}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {riwayatSesi.length === 0 && (
                  <div
                    style={{
                      padding: '32px 20px',
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: '14px',
                      background: '#FFF',
                      border: '1px dashed rgba(0,0,0,0.12)',
                      borderRadius: '20px'
                    }}
                  >
                    Belum ada riwayat sesi yang tercatat
                  </div>
                )}
              </div>

              {riwayatSesi.length > 4 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#FFF',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: '100px',
                      color: 'var(--ink)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '8px 18px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                    }}
                  >
                    {showAllHistory ? (
                      <>Tampilkan Lebih Sedikit <ChevronUp size={15} /></>
                    ) : (
                      <>Lihat Semua Riwayat ({riwayatSesi.length}) <ChevronDown size={15} /></>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Riwayat Pembayaran Tab */}
        {activeView === 'membership' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Riwayat Pembayaran Membership ({payments.length})
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {payments.map((payment: any) => (
                <div
                  key={payment.id}
                  className="card"
                  style={{
                    padding: '22px',
                    background: '#FFFFFF',
                    borderRadius: '22px',
                    border: '1px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                        {formatDate(payment.date)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>
                        ID #{payment.id.substring(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: payment.status === 'Lunas' ? '#15803D' : '#B45309',
                        background: payment.status === 'Lunas' ? '#DCFCE7' : '#FEF3C7',
                        padding: '4px 10px',
                        borderRadius: '100px'
                      }}
                    >
                      {payment.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13.5px', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Paket Langganan</span>
                      <b style={{ color: 'var(--ink)' }}>{payment.package}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Nominal Pembayaran</span>
                      <b style={{ color: '#0F172A', fontSize: '15px' }}>{payment.price}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Metode</span>
                      <span style={{ color: 'var(--ink)' }}>{payment.method}</span>
                    </div>
                  </div>

                  {payment.proofUrl ? (
                    <button
                      onClick={() => {
                        setSelectedProof(payment.proofUrl);
                        setPopup('bukti');
                      }}
                      style={{
                        width: '100%',
                        padding: '13px',
                        background: '#FAF7F2',
                        color: 'var(--ink)',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <ImageIcon size={16} />
                      <span>Lihat Bukti Transfer</span>
                    </button>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', fontStyle: 'italic', padding: '6px 0' }}>
                      Bukti transfer belum diunggah atau diproses langsung oleh Admin
                    </div>
                  )}
                </div>
              ))}

              {payments.length === 0 && (
                <div
                  style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    color: 'var(--muted)',
                    fontSize: '14px',
                    background: '#FFF',
                    border: '1px dashed rgba(0,0,0,0.12)',
                    borderRadius: '20px'
                  }}
                >
                  Belum ada riwayat pembayaran membership
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kehadiran Modal */}
      {popup === 'kehadiran' && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPopup(null);
          }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 700 }}>Detail Kehadiran Member</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Total Sesi Selesai</span>
                <span style={{ fontWeight: 600 }}>{member.totalSessions}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Persentase Kehadiran</span>
                <span style={{ fontWeight: 700, color: 'var(--green)' }}>{member.attendanceRate}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Total Tidak Hadir (No-Show)</span>
                <span style={{ fontWeight: 600, color: member.noShowCount > 0 ? 'var(--danger)' : 'var(--muted)' }}>
                  {member.noShowCount}
                </span>
              </div>
            </div>
            <button
              onClick={() => setPopup(null)}
              style={{ width: '100%', marginTop: '24px', padding: '14px', background: 'var(--ink)', color: '#FFF', borderRadius: '14px', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Modal Bukti Pembayaran */}
      {popup === 'bukti' && selectedProof && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPopup(null);
          }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '20px', width: '100%', maxWidth: '380px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Bukti Transfer Member</h3>
              <button
                onClick={() => setPopup(null)}
                style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', background: '#F8F6F0', display: 'flex', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.06)' }}>
              <img src={selectedProof} alt="Bukti Transfer" style={{ width: '100%', maxHeight: '480px', objectFit: 'contain' }} />
            </div>
            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
              <a
                href={selectedProof}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Buka di tab baru</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
