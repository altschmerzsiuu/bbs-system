'use client';

import { useFCM } from '../hooks/use-fcm';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function FCMRegistrar() {
  const { registerToken, permission } = useFCM();
  const hasShownToast = useRef(false);

  useEffect(() => {
    // All localStorage access must be inside useEffect (client-only)
    if (localStorage.getItem('bbs_fcm_dismissed') === '1') return;
    if (permission !== 'default') return;
    if (hasShownToast.current) return;

    hasShownToast.current = true;

    const toastId = toast('Enable notifications', {
      description: 'Stay updated on BBS',
      icon: '🔔',
      duration: 10000,
      action: {
        label: 'Enable',
        onClick: async () => {
          localStorage.setItem('bbs_fcm_dismissed', '1');
          toast.dismiss(toastId);
          await registerToken();
          toast.success('Notifications enabled');
        }
      },
      cancel: {
        label: 'Close',
        onClick: () => {
          localStorage.setItem('bbs_fcm_dismissed', '1');
          toast.dismiss(toastId);
        }
      }
    });
  }, [permission, registerToken]);

  return null;
}
