import React from 'react';
import Link from 'next/link';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 60)  return `${mins}m lalu`;
  if (hours < 24) return `${hours}j lalu`;
  return `${days}h lalu`;
}

export default async function NotificationsPage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const { data: notifications } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', actor.userId)
    .order('created_at', { ascending: false });

  const list = notifications ?? [];

  return (
    <div>
      <div className="top">
        <div className="who">
          <b style={{ fontSize: '24px', letterSpacing: '-.8px' }}>Notifikasi</b>
          <span>{list.length} pesan</span>
        </div>
        <div className="bell">🔔</div>
      </div>

      {list.length === 0 ? (
        <div className="note" style={{ textAlign: 'center', marginTop: '20px' }}>
          Belum ada notifikasi baru.
        </div>
      ) : (
        list.map((n: any) => (
          <div key={n.id} className="card">
            <div className="date" style={{ background: 'var(--sage-soft)', borderColor: 'transparent' }}>
              <b>✓</b>
            </div>
            <div className="body">
              <b>{n.title || 'Update Sistem'}</b>
              <span>{n.body || ''} · {timeAgo(n.created_at)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
