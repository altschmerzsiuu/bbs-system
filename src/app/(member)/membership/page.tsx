import React from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, Check, Ticket, Calendar, Bell, Sparkles,
  Clock, MessageCircle, AlertCircle, CheckCircle2, ArrowRight 
} from 'lucide-react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { RenewModal } from './renew-modal';
import { UploadReceiptModal } from './upload-receipt-modal';

const BENEFITS = [
  { text: 'Priority booking access', icon: Calendar },
  { text: 'Access to special events', icon: Ticket },
  { text: 'Member-only updates', icon: Bell },
];

export default async function MembershipPage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const [
    { data: user },
    { data: plans },
    { data: activeMembership },
    { data: pendingActivationMembership },
    { data: activeApp },
    { data: settings }
  ] = await Promise.all([
    db.from('users').select('full_name').eq('id', actor.userId!).single(),
    db.from('membership_plans').select('id, code, name, price_idr, credits, duration_months').order('price_idr', { ascending: false }),
    db.from('memberships').select('*, membership_plans(name)').eq('member_id', actor.memberId!).eq('status', 'ACTIVE').maybeSingle(),
    db.from('memberships').select('*, membership_plans(name)').eq('member_id', actor.memberId!).eq('status', 'PENDING_ACTIVATION').maybeSingle(),
    db.from('membership_applications').select('*, membership_plans(name)').eq('member_id', actor.memberId!).in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('system_settings').select('key, value').in('key', ['payment_bank_name', 'payment_account_number', 'payment_account_name'])
  ]);

  const getSetting = (k: string) => {
    const s = settings?.find((x: any) => x.key === k);
    return s?.value ? String(s.value).replace(/^"|"$/g, '') : '';
  };

  const bankName = getSetting('payment_bank_name');
  const accountNumber = getSetting('payment_account_number');
  const accountName = getSetting('payment_account_name');
  const whatsappAdminNumber = process.env.NEXT_PUBLIC_WHATSAPP_ADMIN_NUMBER || '6281255558888';

  const initials = user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';

  let remainingCredits  = 0;
  let usedCredits       = 0;
  let totalCredits      = activeMembership?.allocated_credits ?? 0;
  
  if (activeMembership) {
    const { data: state } = await db.rpc('membership_credit_state', { p_membership_id: activeMembership.id });
    const s = Array.isArray(state) ? state[0] : state;
    remainingCredits = s?.available ?? 0;
    usedCredits      = totalCredits - remainingCredits;
  }

  const progressPct = totalCredits > 0 ? Math.round((usedCredits / totalCredits) * 100) : 0;
  const planName    = activeMembership?.membership_plans?.name ?? null;
  const isSilver    = planName?.toLowerCase().includes('silver') ?? false;
  const cardBg      = isSilver ? 'linear-gradient(135deg, #f5f5f5 0%, #d4d4d4 50%, #b8b8b8 100%)' : 'linear-gradient(135deg, #d8bc80 0%, #ecd39d 50%, #c4a35d 100%)';
  const cardColor   = isSilver ? '#333333' : '#3a2e1a';
  const eyebrowColor= isSilver ? '#333333' : '#5a4214';
  const iconBg      = isSilver ? 'rgba(51, 51, 51, 0.1)' : 'rgba(90, 66, 20, 0.1)';
  const progressBg  = isSilver ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)';

  return (
    <div style={{ background: 'var(--white)', paddingBottom: '32px' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 24px' }}>
        <div>
          <Link href="/home">
            <button style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', border: '1px solid #efeade', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
          </Link>
          <h1 style={{ font: '40px/1.1 var(--font-display)', margin: '0 0 4px 0', color: 'var(--ink)' }}>Your Membership</h1>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>Ride more, grow further.</p>
        </div>
      </div>

      <div style={{ padding: '0 24px' }}>
        {/* ── Membership Gold/Silver Card ── */}
        {activeMembership ? (
          <div style={{
            background: cardBg,
            borderRadius: '24px',
            padding: '24px',
            color: cardColor,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 12px 24px rgba(216, 188, 128, 0.25)',
            marginBottom: '32px'
          }}>
            {/* Background abstract shape */}
            <div style={{ position: 'absolute', right: '-10%', bottom: '-20%', opacity: 0.1, transform: 'rotate(-15deg)' }}>
              <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100 0C155.228 0 200 44.7715 200 100C200 155.228 155.228 200 100 200C44.7715 200 0 155.228 0 100C0 44.7715 44.7715 0 100 0ZM100 180C144.183 180 180 144.183 180 100C180 55.8172 144.183 20 100 20C55.8172 20 20 55.8172 20 100C20 144.183 55.8172 180 100 180Z" fill="currentColor"/>
              </svg>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1.5px', color: eyebrowColor }}>
                {planName?.toUpperCase() || 'MEMBER'} MEMBER
              </span>
              <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} color={eyebrowColor} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '16px', position: 'relative', zIndex: 1 }}>
              <span style={{ font: '64px/1 var(--font-display)', letterSpacing: '-2px' }}>{remainingCredits}</span>
              <span style={{ font: '20px var(--font-display)' }}>sessions left</span>
            </div>

            <div style={{ marginTop: '24px', position: 'relative', zIndex: 1 }}>
              <div style={{ height: '12px', background: progressBg, borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: cardColor, width: `${progressPct}%`, borderRadius: '6px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px', color: eyebrowColor, fontWeight: 500 }}>
                <span>{usedCredits} used</span>
                <span>{totalCredits} total</span>
              </div>
            </div>

            <div style={{ marginTop: '24px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '12px', color: isSilver ? 'rgba(51, 51, 51, 0.7)' : 'rgba(90, 66, 20, 0.7)', marginBottom: '2px' }}>Valid until</div>
              <b style={{ font: '16px var(--font-display)' }}>
                {new Date(activeMembership.end_date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </b>
            </div>

            {/* ── Member Benefits (Inside Card) ── */}
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${iconBg}`, position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', marginBottom: '16px', color: eyebrowColor }}>
                MEMBER BENEFITS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {BENEFITS.map((benefit, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <benefit.icon size={16} color={eyebrowColor} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Pending Renewal Status inside Card ── */}
            {activeApp && ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED', 'REJECTED'].includes(activeApp.status) && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid ${iconBg}`, position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', marginBottom: '12px', color: eyebrowColor }}>
                  RENEWAL STATUS
                </div>
                {activeApp.status === 'APPROVED' ? (
                  <>
                    <div style={{ fontSize: '13px', marginBottom: '8px', fontWeight: 500, color: cardColor, lineHeight: 1.4 }}>
                      Pengajuan perpanjangan diterima. Silakan selesaikan pembayaran.
                    </div>
                    <UploadReceiptModal 
                      applicationId={activeApp.id}
                      finalPriceIdr={activeApp.final_price_idr || 0}
                      bankName={bankName}
                      accountNumber={accountNumber}
                      accountName={accountName}
                      rejectionReason={activeApp.rejection_reason}
                    />
                  </>
                ) : activeApp.status === 'REJECTED' ? (
                  <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#b91c1c', fontSize: '13px', lineHeight: 1.4 }}>
                    <b style={{ display: 'block', marginBottom: '4px' }}>Pembayaran Ditolak</b>
                    {activeApp.rejection_reason || 'Bukti transfer tidak valid. Silakan ajukan ulang.'}
                  </div>
                ) : (
                  <div style={{
                    padding: '16px',
                    borderRadius: '16px',
                    background: isSilver ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.45)',
                    border: `1px solid ${iconBg}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color={eyebrowColor} />
                      <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: eyebrowColor }}>
                        SEDANG DALAM TAHAP REVIEW ADMIN
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: cardColor, lineHeight: 1.4 }}>
                      Bukti transfer perpanjangan (<b>{activeApp.human_id}</b>) telah diterima dan sedang diverifikasi oleh admin BBS.
                    </div>
                    <a
                      href={`https://wa.me/${whatsappAdminNumber}?text=${encodeURIComponent(`Halo Admin BBS, saya ingin konfirmasi perpanjangan membership dengan ID ${activeApp.human_id}. Terima kasih!`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '10px 16px',
                        borderRadius: '100px',
                        background: '#FFF',
                        color: '#25D366',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '1px solid #D5EAD8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        alignSelf: 'flex-start',
                        marginTop: '4px'
                      }}
                    >
                      <MessageCircle size={14} />
                      <span>Chat WhatsApp Admin</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: 'linear-gradient(135deg, #fbf8f1 0%, #f4eade 100%)',
            borderRadius: '24px',
            padding: '32px 24px',
            textAlign: 'center',
            marginBottom: '32px',
            border: '1px solid #eaddbd'
          }}>
            {activeApp && ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED', 'REJECTED'].includes(activeApp.status) ? (
              activeApp.status === 'PAYMENT_SUBMITTED' || activeApp.status === 'PENDING_REVIEW' ? (
                <div>
                  {/* Glowing Status Icon */}
                  <div style={{ position: 'relative', width: '72px', height: '72px', margin: '0 auto 16px' }}>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'rgba(216, 188, 128, 0.35)',
                      filter: 'blur(10px)',
                    }} />
                    <div style={{
                      position: 'relative',
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #FFF9ED 0%, #F5E8CC 100%)',
                      border: '2px solid #D8BC80',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#7D5F1A',
                      boxShadow: '0 6px 16px rgba(216, 188, 128, 0.25)'
                    }}>
                      <Clock size={32} strokeWidth={2.2} />
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    padding: '6px 14px',
                    borderRadius: '100px',
                    background: '#FEF3C7',
                    color: '#92400E',
                    display: 'inline-block',
                    marginBottom: '12px'
                  }}>
                    SEDANG DALAM TAHAP REVIEW ADMIN
                  </span>

                  <div style={{ font: '26px/1.2 var(--font-display)', margin: '0 0 10px', color: 'var(--ink)' }}>
                    Pengajuan Sedang Diverifikasi
                  </div>

                  <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
                    Bukti pembayaran dan data diri kamu sudah kami terima. Admin BBS sedang memverifikasi pembayaran membership kamu.
                  </p>

                  {/* 4-Layer Stepper Tracker */}
                  <div style={{
                    background: '#FFF',
                    borderRadius: '18px',
                    padding: '16px',
                    marginBottom: '20px',
                    border: '1px solid #ECE7DC',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    textAlign: 'left'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#15803D', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>1. Data Diri & Profil Pengajuan</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#15803D', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>2. Pilih Paket ({activeApp.membership_plans?.name || 'Membership'})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#15803D', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>3. Bukti Transfer Diunggah</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#FEF3C7', color: '#92400E', border: '1.5px solid #F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Clock size={12} strokeWidth={2.5} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>4. Verifikasi & Aktivasi Admin (Sedang Berjalan)</span>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div style={{
                    background: '#FFF',
                    borderRadius: '18px',
                    padding: '16px',
                    marginBottom: '20px',
                    border: '1px solid #ECE7DC',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--muted)' }}>Kode Pengajuan</span>
                      <b style={{ fontFamily: 'monospace', color: 'var(--ink)' }}>{activeApp.human_id}</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--muted)' }}>Paket Keanggotaan</span>
                      <b style={{ color: 'var(--ink)' }}>{activeApp.membership_plans?.name}</b>
                    </div>
                    {activeApp.final_price_idr ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'var(--muted)' }}>Total Pembayaran</span>
                        <b style={{ color: 'var(--ink)' }}>Rp {activeApp.final_price_idr.toLocaleString('id-ID')}</b>
                      </div>
                    ) : null}
                  </div>

                  {/* WhatsApp Contact Button */}
                  <a
                    href={`https://wa.me/${whatsappAdminNumber}?text=${encodeURIComponent(`Halo Admin BBS, saya ingin konfirmasi status pengajuan membership ${activeApp.membership_plans?.name || ''} dengan ID ${activeApp.human_id}. Mohon bantuannya ya!`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '100px',
                      background: '#FFF',
                      color: '#25D366',
                      fontSize: '14px',
                      fontWeight: 700,
                      border: '1.5px solid #D5EAD8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                      boxShadow: '0 4px 12px rgba(37,211,102,0.1)',
                      marginBottom: '10px'
                    }}
                  >
                    <MessageCircle size={18} />
                    <span>Konfirmasi via WhatsApp Admin</span>
                  </a>

                  <Link href="/request?type=membership" style={{ textDecoration: 'none' }}>
                    <button style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '100px',
                      background: 'var(--ink)',
                      color: '#FFF',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer'
                    }}>
                      Buka Rincian Pengajuan
                    </button>
                  </Link>
                </div>
              ) : activeApp.status === 'APPROVED' ? (
                <>
                  <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', color: '#b08d4b' }}>
                    PENGAJUAN {activeApp.membership_plans?.name?.toUpperCase()}
                  </span>
                  <div style={{ font: '32px/1.2 var(--font-display)', margin: '16px 0 12px', color: 'var(--ink)' }}>
                    Pengajuan Disetujui
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.5 }}>
                    Silakan selesaikan pembayaran dan unggah bukti transfer di bawah ini.
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <UploadReceiptModal 
                      applicationId={activeApp.id}
                      finalPriceIdr={activeApp.final_price_idr || 0}
                      bankName={bankName}
                      accountNumber={accountNumber}
                      accountName={accountName}
                      rejectionReason={activeApp.rejection_reason}
                    />
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '20px', color: '#b91c1c', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <AlertCircle size={20} />
                    <b style={{ fontSize: '16px' }}>Pembayaran Ditolak</b>
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: 1.5, margin: '0 0 16px', color: '#991b1b' }}>
                    {activeApp.rejection_reason || 'Bukti transfer tidak dapat diverifikasi oleh admin. Silakan ajukan ulang.'}
                  </p>
                  <Link href="/request?type=membership" style={{ textDecoration: 'none' }}>
                    <button style={{ width: '100%', padding: '14px', borderRadius: '100px', background: '#b91c1c', color: '#FFF', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                      Ajukan Ulang Membership
                    </button>
                  </Link>
                </div>
              )
            ) : (
              <>
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', color: '#b08d4b' }}>NO ACTIVE MEMBERSHIP</span>
                <div style={{ font: '32px/1.2 var(--font-display)', margin: '16px 0 12px', color: 'var(--ink)' }}>
                  Start your journey with BBS
                </div>
                <div style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '24px' }}>
                  Upgrade ke paket Gold atau Silver untuk mendapatkan akses prioritas, harga lebih hemat, dan benefit eksklusif lainnya.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                  {(plans ?? []).map((plan: any) => {
                    const planNameLower = plan.name.toLowerCase();
                    let eyebrowColor = 'var(--muted)';
                    let cardBg = '#fff';
                    let cardTextColor = 'var(--ink)';
                    
                    if (planNameLower.includes('gold')) {
                      eyebrowColor = '#5a4214';
                      cardBg = 'linear-gradient(135deg, #f3e9d2, #d1a85b)';
                    } else if (planNameLower.includes('silver')) {
                      eyebrowColor = '#333';
                      cardBg = 'linear-gradient(135deg, #f5f5f5, #b8b8b8)';
                    }
                    
                    return (
                      <div key={plan.id} style={{ background: cardBg, borderRadius: '20px', padding: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', color: eyebrowColor }}>
                            {plan.name.toUpperCase()}
                          </span>
                          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={14} color={eyebrowColor} />
                          </div>
                        </div>
                        <div style={{ font: '32px var(--font-display)', color: cardTextColor, margin: '8px 0' }}>
                          {plan.credits} <span style={{ fontSize: '18px', opacity: 0.8 }}>sessions</span>
                        </div>
                        <div style={{ fontSize: '14px', color: cardTextColor, opacity: 0.8, fontWeight: 500, marginBottom: '20px' }}>
                          {plan.duration_months} months · Rp {(plan.price_idr / 1000).toLocaleString('id-ID')}k
                        </div>
                        
                        <Link href={`/request?type=membership`} style={{ textDecoration: 'none' }}>
                          <button style={{ width: '100%', padding: '14px', borderRadius: '100px', background: 'var(--ink)', color: '#fff', fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            Join {plan.name}
                          </button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Pending activation notice ── */}
        {pendingActivationMembership && (
          <div style={{ 
            padding: '20px', 
            borderRadius: '20px', 
            background: 'linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%)', 
            border: '1px solid #3A3A3A',
            marginBottom: '24px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)'
          }}>
            {/* Subtle glow effect */}
            <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '150%', height: '200%', background: 'radial-gradient(circle, rgba(209,168,91,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
            
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(209,168,91,0.15)', border: '1px solid rgba(209,168,91,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', zIndex: 1 }}>
              <Calendar size={22} color="#d1a85b" />
            </div>
            
            <div style={{ position: 'relative', zIndex: 1, paddingRight: '8px' }}>
              <div style={{ fontWeight: 800, fontSize: '11px', letterSpacing: '1px', color: '#d1a85b', marginBottom: '6px', textTransform: 'uppercase' }}>
                Early Renewal Active
              </div>
              <div style={{ fontSize: '14px', color: '#FFF', lineHeight: 1.5, fontWeight: 400 }}>
                Your <b style={{ fontWeight: 600, color: '#f3e9d2' }}>{pendingActivationMembership.membership_plans?.name}</b> plan will automatically activate on{' '}
                <span style={{ color: '#d1a85b', fontWeight: 600 }}>{new Date(pendingActivationMembership.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>.
              </div>
            </div>
          </div>
        )}

        {/* ── Removed Old Status Cards at Bottom ── */}
        
        {(!pendingActivationMembership && (!activeApp || !['PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED'].includes(activeApp.status)) && activeMembership) ? (
          <>
            {/* ── Available Plans Modal (Renew) ── */}
            <RenewModal plans={plans || []} activeMembership={activeMembership} />
          </>
        ) : null}
      </div>
    </div>
  );
}
