'use client';

import React from 'react';
import { createClient } from '@/infrastructure/supabase-browser';

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
      className="btn line"
      style={{ color: 'var(--clay)', borderColor: 'rgba(181, 112, 94, .4)' }}
    >
      Keluar
    </button>
  );
}
