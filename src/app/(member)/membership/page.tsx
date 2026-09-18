import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Check, Ticket, Calendar, Bell, Sparkles } from 'lucide-react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { RenewModal } from './renew-modal';

const BENEFITS = [
  { text: 'Priority booking access', icon: Calendar },
  { text: 'Access to special events', icon: Ticket },
  { text: 'Member-only updates', icon: Bell },
];

export default async function MembershipPage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const { data: user } = await db
    .from('users')
    .select('full_name')
    .eq('id', actor.userId!)
    .single();
  
  const initials = user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U';

  const { data: plans } = await db
    .from('membership_plans')
    .select('id, code, name, price_idr, credits, duration_months')
    .order('price_idr', { ascending: false });

  const { data: activeMembership } = await db
    .from('memberships')
    .select('*, membership_plans(name)')
    .eq('member_id', actor.memberId!)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  const { data: pendingActivationMembership } = await db
    .from('memberships')
    .select('*, membership_plans(name)')
    .eq('member_id', actor.memberId!)
    .eq('status', 'PENDING_ACTIVATION')
    .maybeSingle();

  const { data: activeApp } = await db
    .from('membership_applications')
    .select('*, membership_plans(name)')
    .eq('member_id', actor.memberId!)
    .in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED'])
    .maybeSingle();

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

  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh', paddingBottom: '40px' }}>
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
        <Link href="/notifications" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative', color: 'var(--ink)', border: '1px solid #efeade' }}>
          <Bell size={20} strokeWidth={1.75} />
          <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', background: 'var(--red)', borderRadius: '50%', border: '2px solid var(--white)' }}></div>
        </Link>
      </div>

      <div style={{ padding: '0 24px' }}>
        {/* ── Membership Gold Card ── */}
        {activeMembership ? (
          <div style={{
            background: 'linear-gradient(135deg, #d8bc80 0%, #ecd39d 50%, #c4a35d 100%)',
            borderRadius: '24px',
            padding: '24px',
            color: '#3a2e1a',
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
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1.5px', color: '#5a4214' }}>
                {planName?.toUpperCase() || 'MEMBER'} MEMBER
              </span>
              <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'rgba(90, 66, 20, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={18} color="#5a4214" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '16px', position: 'relative', zIndex: 1 }}>
              <span style={{ font: '64px/1 var(--font-display)', letterSpacing: '-2px' }}>{remainingCredits}</span>
              <span style={{ font: '20px var(--font-display)' }}>sessions left</span>
            </div>

            <div style={{ marginTop: '24px', position: 'relative', zIndex: 1 }}>
              <div style={{ height: '12px', background: 'rgba(255,255,255,0.4)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#3a2e1a', width: `${progressPct}%`, borderRadius: '6px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px', color: '#5a4214', fontWeight: 500 }}>
                <span>{usedCredits} used</span>
                <span>{totalCredits} total</span>
              </div>
            </div>

            <div style={{ marginTop: '24px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '12px', color: 'rgba(90, 66, 20, 0.7)', marginBottom: '2px' }}>Valid until</div>
              <b style={{ font: '16px var(--font-display)' }}>
                {new Date(activeMembership.end_date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </b>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'linear-gradient(135deg, #f5f7f5 0%, #eaeaea 100%)',
            borderRadius: '24px',
            padding: '32px 24px',
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)' }}>NO ACTIVE MEMBERSHIP</span>
            <div style={{ font: '28px var(--font-display)', margin: '12px 0 8px', color: 'var(--ink)' }}>
              Start your journey
            </div>
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
              Choose a plan below to get started.
            </div>
          </div>
        )}

        {/* ── Pending activation notice ── */}
        {pendingActivationMembership && (
          <div style={{ padding: '16px', borderRadius: '16px', background: 'var(--greenSoft)', border: '1px solid var(--green)', marginBottom: '24px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--green)' }}>Early Renewal Active</div>
            <div style={{ fontSize: '13px', color: 'var(--green)', marginTop: '4px', lineHeight: 1.4 }}>
              Your <b>{pendingActivationMembership.membership_plans?.name}</b> plan will activate automatically on{' '}
              {new Date(pendingActivationMembership.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </div>
          </div>
        )}

        {/* ── Active Application ── */}
        {activeApp ? (
          <div style={{ padding: '24px', borderRadius: '24px', background: '#fff', border: '1px solid #efeade', marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)' }}>APPLICATION STATUS</span>
            <div style={{ font: '24px var(--font-display)', margin: '8px 0 16px', color: 'var(--ink)' }}>
              {activeApp.membership_plans?.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--muted)' }}>Price</span>
              <b style={{ color: 'var(--ink)' }}>Rp {(activeApp.final_price_idr / 1000).toLocaleString('id-ID')}k</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '16px' }}>
              <span style={{ color: 'var(--muted)' }}>Status</span>
              <span style={{ 
                padding: '4px 10px', 
                borderRadius: '8px', 
                fontSize: '11px', 
                fontWeight: 700,
                background: activeApp.status === 'APPROVED' ? '#dce8dd' : '#eedcb8',
                color: activeApp.status === 'APPROVED' ? '#4c6c51' : '#5a4214'
              }}>
                {activeApp.status.replace(/_/g, ' ')}
              </span>
            </div>

            {activeApp.status === 'PENDING_REVIEW' && (
              <div style={{ padding: '12px', background: '#f5f7f5', borderRadius: '12px', fontSize: '13px', color: 'var(--muted)' }}>
                Admin is reviewing your application. Please wait.
              </div>
            )}

            {activeApp.status === 'APPROVED' && (
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_ADMIN_NUMBER}?text=Halo%20BBS!%20Saya%20ingin%20mengkonfirmasi%20pembayaran%20untuk%20paket%20${encodeURIComponent(activeApp.membership_plans?.name)}.%20ID%20Aplikasi:%20${activeApp.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none', display: 'block', marginTop: '16px' }}
              >
                <button style={{ width: '100%', padding: '16px', borderRadius: '100px', background: 'var(--ink)', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  Confirm Payment →
                </button>
              </a>
            )}

            {activeApp.status === 'PAYMENT_CONFIRMED' && (
              <div style={{ padding: '12px', background: '#f5f7f5', borderRadius: '12px', fontSize: '13px', color: 'var(--muted)' }}>
                Payment received. Your membership will activate shortly.
              </div>
            )}
          </div>
        ) : !pendingActivationMembership ? (
          <>
            {/* ── Member Benefits ── */}
            {activeMembership && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ font: '22px var(--font-display)', color: 'var(--ink)', margin: '0 0 16px 0' }}>
                  Member Benefits
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {BENEFITS.map((benefit, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#f5f7f5', borderRadius: '16px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#dce8dd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <benefit.icon size={14} color="#4c6c51" strokeWidth={2.5} />
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>{benefit.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Available Plans Modal ── */}
            <RenewModal plans={plans || []} activeMembership={activeMembership} />
          </>
        ) : null}
      </div>
    </div>
  );
}
