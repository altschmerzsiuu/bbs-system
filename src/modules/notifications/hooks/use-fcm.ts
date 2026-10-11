'use client';

import { useState, useCallback, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export function useFCM() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Listen for foreground FCM messages
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    isSupported().then((supported) => {
      if (supported && typeof window !== 'undefined') {
        try {
          const messaging = getMessaging(app);
          unsubscribe = onMessage(messaging, (payload) => {
            const title = payload.notification?.title || 'Notifikasi BBS';
            const body = payload.notification?.body || '';
            toast(title, {
              description: body,
              icon: '🔔',
              duration: 6000,
            });
          });
        } catch (e) {
          console.debug('[useFCM] onMessage init skipped:', e);
        }
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const registerToken = useCallback(async () => {
    try {
      setIsRegistering(true);

      const supported = await isSupported();
      if (!supported) {
        console.warn('FCM is not supported in this browser.');
        return false;
      }

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        console.warn('Notification permission not granted.');
        return false;
      }

      const messaging = getMessaging(app);
      
      let swRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn('[FCM] SW registration warning:', swErr);
        }
      }

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) {
        console.warn('No registration token available.');
        return false;
      }

      // Send the token to our server
      const res = await fetch('/api/fcm/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
        }),
      });

      if (!res.ok) {
        console.error('Failed to register token with server:', await res.text());
        return false;
      }

      return true;
    } catch (err) {
      console.error('FCM Registration Error:', err);
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  return { registerToken, isRegistering, permission };
}
