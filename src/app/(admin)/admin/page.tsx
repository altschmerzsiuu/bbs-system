export const dynamic = 'force-dynamic';
import React from 'react';
import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import { getAdminHomeData } from '@/modules/admin/admin-home-queries';
import { AdminClient } from './admin-client';

export default async function AdminDashboardPage() {
  const actor = await requireActor(['ADMIN']);
  
  const db = await createServerClient();
  const data = await getAdminHomeData(db);

  const adminName = actor.fullName || 'Admin';

  // Formatting date in Indonesian like "Sabtu · 20 September 2026"
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(now).replace(',', ' ·');

  const [adminUserRes, horsesRes] = await Promise.all([
    db.from('users').select('avatar_url').eq('id', actor.userId).single(),
    db.from('horses').select('id, name, status').eq('status', 'ACTIVE').order('name')
  ]);
  const adminAvatarUrl = adminUserRes.data?.avatar_url || null;
  const horses = horsesRes.data || [];

  return (
    <div className="screen active">
      <AdminClient 
        stats={data.stats}
        pending={data.pending}
        pendingBookingsList={data.pendingBookingsList || []}
        upcoming={data.upcoming}
        currentSession={data.currentSession}
        pastSessions={data.pastSessions}
        todayStr={todayStr}
        adminName={adminName}
        adminAvatarUrl={adminAvatarUrl}
        horses={horses}
      />

    </div>
  );
}
