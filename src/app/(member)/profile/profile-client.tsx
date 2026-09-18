'use client';

import React from 'react';
import { createClient } from '@/infrastructure/supabase-browser';
import { LogOut } from 'lucide-react';

export function ProfileClient() {
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{ 
        width: '40px', 
        height: '40px', 
        borderRadius: '50%', 
        background: '#faeae9', 
        color: '#c06c64', 
        border: 'none', 
        cursor: 'pointer', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}
      title="Sign Out"
    >
      <LogOut size={18} strokeWidth={2.5} />
    </button>
  );
}
