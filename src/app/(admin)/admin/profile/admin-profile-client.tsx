'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/infrastructure/supabase-browser';
import { LogOut, Loader2, KeyRound, BellRing, HelpCircle, FileText, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';

export function AdminProfileClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    const db = createClient();
    await db.auth.signOut();
    window.location.href = '/login';
  };

  const menuItems = [
    { icon: KeyRound, label: 'Ubah Kata Sandi' },
    { icon: BellRing, label: 'Preferensi Notifikasi' },
    { icon: FileText, label: 'Ketentuan Layanan' },
    { icon: HelpCircle, label: 'Pusat Bantuan' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      
      <div style={{ background: '#fff', borderRadius: '24px', border: '1px solid #efeade', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        {menuItems.map((item, i) => (
          <div key={i} 
            onClick={() => toast.custom((t) => <AlertToast title="Segera Hadir" description={`Fitur ${item.label} sedang dalam tahap pengembangan.`} onDismiss={() => toast.dismiss(t)} />)}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              padding: '20px', borderBottom: i < menuItems.length - 1 ? '1px solid #efeade' : 'none', 
              cursor: 'pointer' 
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <item.icon size={20} strokeWidth={2} color="var(--ink)" style={{ opacity: 0.7 }} />
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--ink)' }}>{item.label}</span>
            </div>
            <ChevronRight size={18} strokeWidth={2} color="var(--muted)" />
          </div>
        ))}
      </div>

      <button 
        onClick={handleLogout}
        disabled={loading}
        style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
          width: '100%', padding: '16px', borderRadius: '100px', border: 'none', 
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
