import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { submitMembershipApplication } from './actions';

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

  // Get credit state if membership active
  let remainingCredits = 0;
  if (activeMembership) {
    const { data: state } = await db.rpc('membership_credit_state', { p_membership_id: activeMembership.id });
    const s = Array.isArray(state) ? state[0] : state;
    remainingCredits = s?.available ?? 0;
  }

  return (
    <div>
      <div className="top">
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Membership</b>
          <span>Periode aktif</span>
        </div>
        <Link href="/notifications" className="bell">
          <i></i>🔔
        </Link>
      </div>

      <div className="hero">
        <div className="tag">{activeMembership?.membership_plans?.name || 'Paket saat ini'}</div>
        <div className="big">{activeMembership ? `${remainingCredits} sesi` : 'Belum ada membership'}</div>
        <div className="sub">
          {activeMembership
            ? `tersisa dari ${activeMembership.allocated_credits} · berakhir ${new Date(activeMembership.end_date).toLocaleDateString('id-ID')}`
            : 'Mulai perjalanan berkuda Anda'}
        </div>
      </div>

      {pendingActivationMembership && (
        <div className="card" style={{ flexDirection: 'column', alignItems: 'stretch', marginTop: '16px', backgroundColor: 'var(--sage-soft)', border: '1px solid var(--sage)' }}>
          <b style={{ fontSize: '16px', color: 'var(--ink)' }}>Early Renewal Aktif</b>
          <span style={{ fontSize: '13px', color: 'var(--ink-2)', marginTop: '4px' }}>
            Paket <b>{pendingActivationMembership.membership_plans?.name}</b> Anda akan otomatis aktif pada {new Date(pendingActivationMembership.start_date).toLocaleDateString('id-ID')}.
          </span>
        </div>
      )}

      {activeApp ? (
        <div className="card" style={{ flexDirection: 'column', alignItems: 'stretch', marginTop: '24px', backgroundColor: 'var(--surface-2)', border: '1px solid var(--gold-deep)' }}>
          <b style={{ fontSize: '18px', color: 'var(--gold-deep)' }}>Status Aplikasi</b>
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--ink-2)' }}>Paket:</span>
              <b>{activeApp.membership_plans?.name}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--ink-2)' }}>Harga:</span>
              <b>Rp {(activeApp.final_price_idr / 1000).toLocaleString('id-ID')}k</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--ink-2)' }}>Status:</span>
              <b style={{ 
                color: activeApp.status === 'APPROVED' ? '#4CAF50' : 
                       activeApp.status === 'PAYMENT_CONFIRMED' ? '#2196F3' : 'var(--ink-1)' 
              }}>
                {activeApp.status.replace('_', ' ')}
              </b>
            </div>
          </div>
          
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
            {activeApp.status === 'PENDING_REVIEW' && (
              <p style={{ fontSize: '14px', margin: 0 }}>Admin sedang meninjau aplikasi {activeApp.application_type.toLowerCase()} Anda. Mohon tunggu.</p>
            )}
            
            {activeApp.status === 'APPROVED' && (
              <>
                <p style={{ fontSize: '14px', margin: '0 0 12px 0' }}>Aplikasi disetujui! Silakan lanjutkan pembayaran melalui WhatsApp.</p>
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_ADMIN_NUMBER}?text=Halo%20BBS!%20Saya%20ingin%20mengkonfirmasi%20pembayaran%20untuk%20paket%20${encodeURIComponent(activeApp.membership_plans?.name)}.%20ID%20Aplikasi:%20${activeApp.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <button className="btn gold" style={{ width: '100%' }}>Konfirmasi Pembayaran</button>
                </a>
              </>
            )}

            {activeApp.status === 'PAYMENT_CONFIRMED' && (
              <p style={{ fontSize: '14px', margin: 0 }}>Pembayaran Anda sedang dikonfirmasi oleh Admin. Keanggotaan Anda akan segera aktif.</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="sec">
            <h3>{activeMembership ? 'Perpanjang Paket' : 'Paket tersedia'}</h3>
          </div>

          {!pendingActivationMembership && (plans ?? []).map((plan: any) => (
            <div key={plan.id} className="card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '16px' }}>{plan.name}</b>
                <b style={{ fontSize: '16px', color: 'var(--gold-deep)' }}>
                  Rp {(plan.price_idr / 1000).toLocaleString('id-ID')}k
                </b>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--ink-2)', marginTop: '4px' }}>
                {plan.credits} sesi · masa berlaku {plan.duration_months} bulan
              </span>
              
              <form action={submitMembershipApplication.bind(null, plan.id)}>
                <button className="btn gold" type="submit" style={{ marginTop: '12px', width: '100%' }}>
                  Aktivasi {plan.name}
                </button>
              </form>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
