import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, Ticket, Calendar, Bell, Sparkles } from 'lucide-react';
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
                  <div style={{ fontSize: '13px', fontWeight: 500, color: cardColor }}>
                    Sedang diproses oleh Admin...
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
              <>
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1.5px', color: '#b08d4b' }}>
                  PENGAJUAN {activeApp.membership_plans?.name?.toUpperCase()}
                </span>
                <div style={{ font: '32px/1.2 var(--font-display)', margin: '16px 0 12px', color: 'var(--ink)' }}>
                  Sedang Diproses
                </div>
                <div style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.5 }}>
                  Membership kamu sedang dalam proses. {activeApp.status === 'APPROVED' ? 'Silakan selesaikan pembayaran di bawah ini.' : 'Mohon tunggu konfirmasi admin.'}
                </div>
                {activeApp.status === 'APPROVED' && (
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
                )}
                {activeApp.status === 'REJECTED' && (
                  <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', color: '#b91c1c', fontSize: '14px', lineHeight: 1.5, textAlign: 'left' }}>
                    <b style={{ display: 'block', marginBottom: '4px' }}>Pembayaran Ditolak</b>
                    {activeApp.rejection_reason || 'Bukti transfer tidak valid. Silakan ajukan ulang perpanjangan.'}
                  </div>
                )}
              </>
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
