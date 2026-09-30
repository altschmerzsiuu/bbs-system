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

  // Get admin name from users table
  const { data: userData } = await db.from('users').select('full_name').eq('id', actor.userId).single();
  const adminName = userData?.full_name || 'Admin';

  // Formatting date in Indonesian like "Sabtu · 20 September 2026"
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(now).replace(',', ' ·');

  return (
    <div className="screen active">
      <AdminClient 
        stats={data.stats}
        pending={data.pending}
        upcoming={data.upcoming}
        currentSession={data.currentSession}
        todayStr={todayStr}
        adminName={adminName}
      />
    </div>
  );
}
