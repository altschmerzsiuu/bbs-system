'use client';

import { useFCM } from '../hooks/use-fcm';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function FCMRegistrar() {
  const { registerToken, permission } = useFCM();
  const hasRegistered = useRef(false);
  const hasShownToast = useRef(false);

  useEffect(() => {
    // If permission is already granted, automatically register/refresh token on the server
    if (permission === 'granted' && !hasRegistered.current) {
      hasRegistered.current = true;
      registerToken().catch((e) => console.error('[FCMRegistrar] Auto register failed:', e));
      return;
    }

    // If permission is default, prompt user
    if (permission === 'default') {
      if (localStorage.getItem('bbs_fcm_dismissed') === '1') return;
      if (hasShownToast.current) return;

      hasShownToast.current = true;

      const toastId = toast('Aktifkan Notifikasi BBS', {
        description: 'Dapatkan pemberitahuan status booking, reschedule, dan jadwal berkuda.',
        icon: '🔔',
        duration: 12000,
        action: {
          label: 'Aktifkan',
          onClick: async () => {
            localStorage.setItem('bbs_fcm_dismissed', '1');
            toast.dismiss(toastId);
            const ok = await registerToken();
            if (ok) {
              toast.success('Notifikasi berhasil diaktifkan!');
            }
          }
        },
        cancel: {
          label: 'Nanti',
          onClick: () => {
            localStorage.setItem('bbs_fcm_dismissed', '1');
            toast.dismiss(toastId);
          }
        }
      });
    }
  }, [permission, registerToken]);

  return null;
}

