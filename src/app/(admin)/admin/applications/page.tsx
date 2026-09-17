import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { approveApplicationAction, confirmPaymentAction, activateMembershipAction, rejectApplicationAction } from './actions';

export default async function AdminApplicationsPage() {
  await requireActor(['ADMIN']);
  const db = await createServerClient();

  const { data: applications } = await db
    .from('membership_applications')
    .select('*, members(full_name, phone), membership_plans(name)')
    .in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED'])
    .order('created_at', { ascending: true });

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="top" style={{ marginBottom: '24px' }}>
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Membership Applications</b>
          <span>Admin Dashboard</span>
        </div>
        <Link href="/home" className="bell">
          <i></i>🏠
        </Link>
      </div>

      <div className="sec">
        <h3>Pending Applications</h3>
      </div>

      {(!applications || applications.length === 0) && (
        <div className="card">
          <span style={{ color: 'var(--ink-2)' }}>No pending applications.</span>
        </div>
      )}

      {(applications ?? []).map((app: any) => (
        <div key={app.id} className="card" style={{ flexDirection: 'column', alignItems: 'stretch', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <b style={{ fontSize: '16px', display: 'block' }}>{app.members?.full_name}</b>
              <span style={{ fontSize: '12px', color: 'var(--ink-2)' }}>{app.members?.phone}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="chip-state" style={{ 
                backgroundColor: app.status === 'APPROVED' ? 'rgba(76, 175, 80, 0.1)' : 
                                 app.status === 'PAYMENT_CONFIRMED' ? 'rgba(33, 150, 243, 0.1)' : 'rgba(0,0,0,0.05)',
                color: app.status === 'APPROVED' ? '#4CAF50' : 
                       app.status === 'PAYMENT_CONFIRMED' ? '#2196F3' : 'var(--ink-1)'
              }}>
                {app.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          
          <div style={{ backgroundColor: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>Type:</span>
              <b style={{ fontSize: '14px' }}>{app.application_type}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>Plan:</span>
              <b style={{ fontSize: '14px' }}>{app.membership_plans?.name}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>Submitted:</span>
              <span style={{ fontSize: '14px' }}>{formatDate(app.created_at)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--ink-3)' }}>
              <span style={{ fontSize: '14px', color: 'var(--ink-1)' }}>Price:</span>
              <b style={{ fontSize: '14px', color: 'var(--gold-deep)' }}>Rp {(app.final_price_idr / 1000).toLocaleString('id-ID')}k</b>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {app.status === 'PENDING_REVIEW' && (
              <>
                <form action={approveApplicationAction.bind(null, app.id)} style={{ flex: 1 }}>
                  <button type="submit" className="btn gold" style={{ width: '100%' }}>Approve</button>
                </form>
                <form action={rejectApplicationAction.bind(null, app.id)} style={{ flex: 1 }}>
                  <button type="submit" className="btn" style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--ink-3)', color: 'var(--ink-1)' }}>Reject</button>
                </form>
              </>
            )}

            {app.status === 'APPROVED' && (
              <form action={confirmPaymentAction.bind(null, app.id)} style={{ width: '100%' }}>
                <button type="submit" className="btn gold" style={{ width: '100%' }}>Confirm Payment Received</button>
              </form>
            )}

            {app.status === 'PAYMENT_CONFIRMED' && (
              <form action={activateMembershipAction.bind(null, app.id)} style={{ width: '100%' }}>
                <button type="submit" className="btn gold" style={{ width: '100%', backgroundColor: '#4CAF50', color: 'white' }}>Activate Membership</button>
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
