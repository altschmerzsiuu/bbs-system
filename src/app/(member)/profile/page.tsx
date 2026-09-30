import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Award } from 'lucide-react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { ProfileClient } from './profile-client';
import { ProfileSettings } from './profile-settings';

export default async function ProfilePage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const [
    { data: user },
    { data: member },
    { data: activeMembership }
  ] = await Promise.all([
    db.from('users').select('*').eq('id', actor.userId).single(),
    db.from('members').select('*').eq('id', actor.memberId!).maybeSingle(),
    db.from('memberships').select('membership_plans(name)').eq('member_id', actor.memberId!).eq('status', 'ACTIVE').maybeSingle()
  ]);

  const tierName = (activeMembership as any)?.membership_plans?.name ?? 'Basic';
  const initialAvatarUrl = user?.avatar_url || '';

  return (
    <div style={{ background: '#faf9f5', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* ── Top Header ── */}
      <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/home">
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', color: 'var(--ink)' }}>
            <ChevronLeft size={20} strokeWidth={2.5} />
          </div>
        </Link>
        
        <h1 style={{ font: '24px var(--font-display)', margin: 0, color: 'var(--ink)' }}>Profile</h1>
        
        <ProfileClient />
      </div>

      {/* ── Profile Center ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 24px 32px' }}>
        <ProfileSettings initialUser={user} initialMember={member} initialAvatarUrl={initialAvatarUrl} tierName={tierName} />
      </div>
    </div>
  );
}
