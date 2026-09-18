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
      className="primary"
      style={{ background: 'var(--redSoft)', color: 'var(--red)' }}
    >
      <LogOut size={16} strokeWidth={2} />
      Sign Out
    </button>
  );
}
