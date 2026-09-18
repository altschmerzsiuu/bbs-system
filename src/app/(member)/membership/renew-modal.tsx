'use client';
import React, { useState } from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { submitMembershipApplication } from './actions';

export function RenewModal({ plans, activeMembership }: { plans: any[], activeMembership: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div style={{ marginTop: '32px' }}>
        <button 
          onClick={() => setIsOpen(true)}
          style={{ width: '100%', padding: '20px 24px', borderRadius: '100px', background: 'var(--ink)', color: '#fff', fontSize: '16px', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          <span>{activeMembership ? 'Renew Membership' : 'Join Membership'}</span>
          <ArrowRight size={20} />
        </button>
      </div>

      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '32px 32px 0 0', padding: '32px 24px 40px', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <button 
              onClick={() => setIsOpen(false)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: '#f5f5f5', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)' }}
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            <h2 style={{ font: '28px var(--font-display)', margin: '0 0 8px 0', color: 'var(--ink)' }}>
              {activeMembership ? 'Renew / Upgrade' : 'Available Plans'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 24px' }}>
              Choose a plan that fits your riding goals.
            </p>

            {(plans ?? []).map((plan: any) => {
              const planNameLower = plan.name.toLowerCase();
              let eyebrowColor = 'var(--muted)';
              if (planNameLower.includes('gold')) eyebrowColor = '#b59349';
              else if (planNameLower.includes('silver')) eyebrowColor = '#8a8d91';
              else if (planNameLower.includes('bronze')) eyebrowColor = '#a97142';
              
              return (
                <div key={plan.id} style={{ background: '#fff', border: '1px solid #efeade', borderRadius: '24px', padding: '24px', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', color: eyebrowColor }}>
                    {plan.name.toUpperCase()}
                  </span>
                  <div style={{ font: '32px var(--font-display)', color: 'var(--ink)', margin: '4px 0 8px' }}>
                    {plan.credits} sessions
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                    {plan.duration_months} months · Rp {(plan.price_idr / 1000).toLocaleString('id-ID')}k
                  </div>
                  
                  <form action={submitMembershipApplication.bind(null, plan.id)}>
                    <button type="submit" style={{ width: '100%', padding: '16px', borderRadius: '100px', background: 'var(--ink)', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', cursor: 'pointer', marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                      {activeMembership ? `Renew with ${plan.name}` : `Join ${plan.name}`} <Sparkles size={16} />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
