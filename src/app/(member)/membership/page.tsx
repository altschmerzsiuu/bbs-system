import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { submitMembershipApplication } from './actions';

const BENEFITS = [
  'Priority booking access',
  'Access to special events',
  'Member-only updates',
];

export default async function MembershipPage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

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
    <div>
      {/* ── Top ── */}
      <div className="top">
        <div className="topmain">
          <h2>Your Membership</h2>
          <span className="sub">Ride more, grow further.</span>
        </div>
      </div>

      {/* ── Membership Gold Card ── */}
      {activeMembership ? (
        <div className="membership-card">
          <span className="eyebrow" style={{ color: '#554728' }}>
            {planName?.toUpperCase() || 'MEMBER'}
          </span>
          <div className="count">
            {remainingCredits} <small>sessions left</small>
          </div>
          <div className="progress">
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(20,20,20,.6)' }}>
            <span>{usedCredits} used</span>
            <span>{totalCredits} total</span>
          </div>
          <div style={{ fontSize: '11px', marginTop: '16px', color: 'rgba(20,20,20,.6)' }}>Valid until</div>
          <b style={{ fontSize: '13px', color: '#3a2e1a' }}>
            {new Date(activeMembership.end_date).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}
          </b>
        </div>
      ) : (
        <div className="membership-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '160px' }}>
          <span className="eyebrow" style={{ color: '#554728' }}>NO ACTIVE MEMBERSHIP</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginTop: '10px', color: '#3a2e1a' }}>
            Start your journey
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(20,20,20,.55)', marginTop: '6px' }}>
            Choose a plan below to get started.
          </div>
        </div>
      )}

      {/* ── Pending activation notice ── */}
      {pendingActivationMembership && (
        <div className="card" style={{ marginTop: '12px', background: 'var(--greenSoft)', border: '1px solid var(--green)' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--green)' }}>Early Renewal Active</div>
          <div style={{ fontSize: '12px', color: 'var(--green)', marginTop: '4px' }}>
            Your <b>{pendingActivationMembership.membership_plans?.name}</b> plan will activate automatically on{' '}
            {new Date(pendingActivationMembership.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </div>
        </div>
      )}

      {/* ── Active Application ── */}
      {activeApp ? (
        <div className="card" style={{ marginTop: '16px' }}>
          <span className="eyebrow">APPLICATION STATUS</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', margin: '10px 0 4px' }}>
            {activeApp.membership_plans?.name}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px' }}>
            <span style={{ color: 'var(--muted)' }}>Price</span>
            <b>Rp {(activeApp.final_price_idr / 1000).toLocaleString('id-ID')}k</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '6px' }}>
            <span style={{ color: 'var(--muted)' }}>Status</span>
            <span className={`pill ${activeApp.status === 'APPROVED' ? 'ok' : 'wait'}`}>
              {activeApp.status.replace(/_/g, ' ')}
            </span>
          </div>

          {activeApp.status === 'PENDING_REVIEW' && (
            <div className="note" style={{ marginTop: '12px', fontSize: '12px' }}>
              Admin is reviewing your application. Please wait.
            </div>
          )}

          {activeApp.status === 'APPROVED' && (
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_ADMIN_NUMBER}?text=Halo%20BBS!%20Saya%20ingin%20mengkonfirmasi%20pembayaran%20untuk%20paket%20${encodeURIComponent(activeApp.membership_plans?.name)}.%20ID%20Aplikasi:%20${activeApp.id}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <button className="primary" style={{ marginTop: '12px', background: 'var(--gold)', color: '#171717' }}>
                Confirm Payment →
              </button>
            </a>
          )}

          {activeApp.status === 'PAYMENT_CONFIRMED' && (
            <div className="note" style={{ marginTop: '12px', fontSize: '12px' }}>
              Payment received. Your membership will activate shortly.
            </div>
          )}
        </div>
      ) : !pendingActivationMembership ? (
        <>
          {/* ── Member Benefits ── */}
          {activeMembership && (
            <>
              <div className="section">
                <b>Member Benefits</b>
              </div>
              <div className="benefits">
                {BENEFITS.map(benefit => (
                  <div key={benefit} className="benefit">
                    <Check size={14} strokeWidth={2.5} color="var(--green)" style={{ flexShrink: 0 }} />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Available Plans ── */}
          <div className="section">
            <b>{activeMembership ? 'Renew / Upgrade' : 'Available Plans'}</b>
          </div>

          {(plans ?? []).map((plan: any) => (
            <div key={plan.id} className="card" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span className="eyebrow" style={{ color: 'var(--muted)' }}>{plan.name.toUpperCase()}</span>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginTop: '4px' }}>
                    {plan.credits} sessions
                  </div>
                  <div className="sub" style={{ marginTop: '2px' }}>
                    {plan.duration_months} months · Rp {(plan.price_idr / 1000).toLocaleString('id-ID')}k
                  </div>
                </div>
              </div>
              <form action={submitMembershipApplication.bind(null, plan.id)}>
                <button className="primary" type="submit" style={{ marginTop: '14px' }}>
                  {activeMembership ? `Renew with ${plan.name}` : `Join ${plan.name}`} →
                </button>
              </form>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
