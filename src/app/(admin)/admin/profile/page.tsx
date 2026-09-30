import React from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { AdminProfileClient } from './AdminProfileClient';

export default async function AdminProfilePage() {
  const actor = await requireActor(['ADMIN']);
  const db    = await createServerClient();

  const { data: user } = await db.from('users').select('*').eq('id', actor.userId).single();

  return (
    <section className="screen active" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="appbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px' }}>
        <Link href="/admin">
          <button style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: 'var(--ink)' }}>
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
        </Link>
        <span style={{ fontSize: '15px', fontWeight: 700 }}>Profile Admin</span>
        <div style={{ width: '36px', height: '36px' }}></div>
      </div>

      <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>
          {(user?.full_name || 'Admin').substring(0, 2).toUpperCase()}
        </div>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: 'var(--ink)' }}>{user?.full_name || 'Admin BBS'}</h2>
        <p style={{ color: 'var(--muted)', margin: '0 0 32px 0', fontSize: '14px' }}>{user?.email}</p>
        
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <AdminProfileClient />
        </div>
      </div>
    </section>
  );
}
