'use client';

import { useFCM } from '../hooks/use-fcm';
import { Bell } from 'lucide-react';

export function FCMRegistrar() {
  const { registerToken, isRegistering, permission } = useFCM();

  if (permission === 'granted') {
    // Optionally return null or a "Notifications Enabled" indicator
    return null; 
  }

  return (
    <div className="bg-bg-elevated p-4 rounded-xl border border-border flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-brand/10 p-2 rounded-lg text-brand">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Nyalakan Notifikasi</h3>
          <p className="text-xs text-ink-dim max-w-[200px]">Dapatkan update jadwal dan membership.</p>
        </div>
      </div>
      <button 
        onClick={registerToken}
        disabled={isRegistering || permission === 'denied'}
        className="px-4 py-2 bg-brand text-ink-inverse text-xs font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors"
      >
        {isRegistering ? 'Memproses...' : permission === 'denied' ? 'Diblokir' : 'Aktifkan'}
      </button>
    </div>
  );
}
