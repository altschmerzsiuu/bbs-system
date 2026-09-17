import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const { data: user }   = await db.from('users').select('*').eq('id', actor.userId).single();
  const { data: member } = await db.from('members').select('*').eq('id', actor.memberId!).maybeSingle();

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
        <div className="avatar" style={{ width: '84px', height: '84px', fontSize: '38px', margin: '0 auto 14px' }}>
          🧑🏻
        </div>
        <b style={{ fontSize: '21px', letterSpacing: '-.5px' }}>{user?.full_name || 'Member BBS'}</b>
        <div style={{ marginTop: '8px' }}>
          <span className="pill wait">{user?.role || 'MEMBER'}</span>
        </div>
      </div>

      <div className="sec">
        <h3>Akun</h3>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', padding: '5px 15px', boxShadow: 'var(--sh)' }}>
        <div className="list-row">
          <span>Email</span>
          <span style={{ color: 'var(--ink-2)' }}>{user?.email}</span>
        </div>
        <div className="list-row">
          <span>Nomor HP</span>
          <span style={{ color: 'var(--ink-2)' }}>{member?.phone || '-'}</span>
        </div>
        <div className="list-row">
          <span>Terdaftar</span>
          <span style={{ color: 'var(--ink-2)' }}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : '-'}
          </span>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <ProfileClient />
      </div>
    </div>
  );
}
