'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/infrastructure/supabase-browser';
import { LogOut, Loader2 } from 'lucide-react';

export function AdminProfileClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    const db = createBrowserClient();
    await db.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <button 
        onClick={handleLogout}
        disabled={loading}
        style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
          width: '100%', padding: '16px', borderRadius: '16px', border: 'none', 
          background: 'var(--redSoft)', color: 'var(--red)', fontSize: '15px', fontWeight: 600, 
          cursor: loading ? 'not-allowed' : 'pointer' 
        }}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
        Keluar Akun
      </button>
    </div>
  );
}
