import React from 'react';
import { User, PhoneCall, Bell, HelpCircle, ChevronRight } from 'lucide-react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { ProfileClient } from './profile-client';

const SETTINGS = [
  { label: 'Personal Information', Icon: User },
  { label: 'Emergency Contact',    Icon: PhoneCall },
  { label: 'Notifications',        Icon: Bell },
  { label: 'Help & FAQ',           Icon: HelpCircle },
];

export default async function ProfilePage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const { data: user }   = await db.from('users').select('*').eq('id', actor.userId).single();
  const { data: member } = await db.from('members').select('*').eq('id', actor.memberId!).maybeSingle();

  // Get active membership tier for badge
  const { data: activeMembership } = await db
    .from('memberships')
    .select('membership_plans(name)')
    .eq('member_id', actor.memberId!)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  const tierName = (activeMembership as any)?.membership_plans?.name ?? null;
  const initials = (user?.full_name || 'M').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div>
      {/* ── Top ── */}
      <div className="top" style={{ marginBottom: '12px' }}>
        <div className="topmain">
          <h2>Profile</h2>
          <span className="sub">Manage your account</span>
        </div>
      </div>

      {/* ── Profile Center ── */}
      <div className="profile-center" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
        <div
          className="profile-avatar"
          style={{ display: 'grid', placeItems: 'center', margin: '0 auto' }}
        >
          {initials}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', marginTop: '10px', marginBottom: '4px' }}>
          {user?.full_name || 'Member BBS'}
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 8px' }}>
          {user?.email}
        </p>
        {tierName && (
          <span className="pill wait" style={{ letterSpacing: '.5px' }}>
            {tierName.toUpperCase()} MEMBER
          </span>
        )}
      </div>

      {/* ── Settings List ── */}
      <div className="settings">
        {SETTINGS.map(({ label, Icon }) => (
          <div key={label} className="setting">
            <Icon size={16} strokeWidth={1.75} color="var(--muted)" />
            <span>{label}</span>
            <ChevronRight size={14} strokeWidth={1.75} color="var(--muted)" />
          </div>
        ))}
      </div>

      {/* ── Additional Info ── */}
      <div className="card" style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingBottom: '10px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--muted)' }}>Phone</span>
          <span style={{ fontWeight: 600 }}>{member?.phone || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '10px' }}>
          <span style={{ color: 'var(--muted)' }}>Member since</span>
          <span style={{ fontWeight: 600 }}>
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
              : '—'}
          </span>
        </div>
      </div>

      {/* ── Sign Out ── */}
      <div style={{ marginTop: '16px' }}>
        <ProfileClient />
      </div>
    </div>
  );
}
