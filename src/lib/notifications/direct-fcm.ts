import { createServiceRoleClient } from '@/infrastructure/supabase-server';

// Ensure Firebase Admin is initialized lazily on the server
async function getFirebaseAdminApp() {
  const { getApps, initializeApp, cert } = await import('firebase-admin/app');

  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[Direct FCM] Firebase admin credentials not fully configured in env.');
    return null;
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error) {
    console.error('[Direct FCM] Firebase admin initialization error:', error);
    return null;
  }
}

export interface DirectPushPayload {
  userIds?: string[];
  toAdmins?: boolean;
  title: string;
  body: string;
  url?: string;
  notificationType: string;
  data?: Record<string, string>;
}

export async function sendDirectPushNotification(payload: DirectPushPayload): Promise<{ success: boolean; sentCount: number }> {
  try {
    // Safety guard: Do not send push notifications to real mobile devices during local development
    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_PUSH !== 'true') {
      console.log('🔔 [Direct FCM] [DEV GUARD] Suppressed push notification to protect real devices:', {
        title: payload.title,
        body: payload.body,
        targetUserIds: payload.userIds,
        toAdmins: payload.toAdmins,
      });
      return { success: true, sentCount: 0 };
    }

    const adminApp = await getFirebaseAdminApp();
    if (!adminApp) {
      console.warn('[Direct FCM] Skipped sending push: Firebase Admin not initialized.');
      return { success: false, sentCount: 0 };
    }

    const { getMessaging } = await import('firebase-admin/messaging');
    const supabase = createServiceRoleClient();
    let targetUserIds: string[] = payload.userIds ? [...payload.userIds] : [];

    if (payload.toAdmins) {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'ADMIN');
      
      if (admins) {
        for (const a of admins) {
          if (!targetUserIds.includes(a.id)) {
            targetUserIds.push(a.id);
          }
        }
      }
    }

    if (targetUserIds.length === 0) {
      return { success: false, sentCount: 0 };
    }

    // Fetch active tokens
    const { data: tokenRows, error: tokenErr } = await supabase
      .from('fcm_tokens')
      .select('token, user_id')
      .in('user_id', targetUserIds);

    if (tokenErr || !tokenRows || tokenRows.length === 0) {
      console.log(`[Direct FCM] No active FCM tokens found for target users: ${targetUserIds.join(', ')}`);
      return { success: false, sentCount: 0 };
    }

    const tokens = Array.from(new Set(tokenRows.map(r => r.token)));
    const messaging = getMessaging(adminApp);

    const dataPayload: Record<string, string> = {
      notification_type: payload.notificationType,
      url: payload.url || '/',
      ...(payload.data || {})
    };

    const response = await messaging.sendEachForMulticast({
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: dataPayload,
      webpush: {
        fcmOptions: {
          link: payload.url || '/'
        },
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          title: payload.title,
          body: payload.body,
        }
      },
      tokens,
    });

    // Cleanup dead tokens
    if (response.failureCount > 0) {
      const deadTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const code = resp.error.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            deadTokens.push(tokens[idx]);
          }
        }
      });

      if (deadTokens.length > 0) {
        await supabase.from('fcm_tokens').delete().in('token', deadTokens);
        console.log(`[Direct FCM] Cleaned up ${deadTokens.length} dead tokens`);
      }
    }

    console.log(`[Direct FCM] Push sent. Success: ${response.successCount}, Failures: ${response.failureCount}`);
    return { success: response.successCount > 0, sentCount: response.successCount };
  } catch (error) {
    console.error('[Direct FCM] Error sending push notification:', error);
    return { success: false, sentCount: 0 };
  }
}
