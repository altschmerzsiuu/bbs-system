import type { NotificationOutboxRow, DeliveryResult, NotificationChannelAdapter } from '../types';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { OutboxRepository } from '../outbox-repository';
import { createServiceRoleClient } from '../../../infrastructure/supabase-server';

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('[FCM Adapter] Firebase admin initialization error', error);
  }
}

export class FCMAdapter implements NotificationChannelAdapter {
  async deliver(notification: NotificationOutboxRow, tokens: string[]): Promise<DeliveryResult> {
    if (tokens.length === 0) {
      // Permanent failure (no tokens available)
      return { success: false, error: 'NO_TOKENS', isPermanentFailure: true };
    }

    try {
      const message = this.buildMessage(notification, tokens);
      const messaging = getMessaging();
      const response = await messaging.sendEachForMulticast(message);

      let successCount = response.successCount;
      let failureCount = response.failureCount;

      if (failureCount > 0) {
        const deadTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              deadTokens.push(tokens[idx]);
            }
          }
        });

        // Cleanup dead tokens
        if (deadTokens.length > 0) {
          const supabase = createServiceRoleClient();
          const repo = new OutboxRepository(supabase as any);
          for (const deadToken of deadTokens) {
            await repo.deleteToken(deadToken);
          }
          console.log(`[FCM Adapter] Cleaned up ${deadTokens.length} dead tokens`);
        }

        // If ALL tokens failed permanently, mark the whole delivery as permanently failed
        if (deadTokens.length === tokens.length) {
          return { success: false, error: 'ALL_TOKENS_DEAD', isPermanentFailure: true };
        }
      }

      // If at least one token succeeded, or if some failed but weren't dead (transient),
      // we consider the overall delivery a "success" in terms of outbox, because we don't
      // want to endlessly retry for one broken device while another succeeded. 
      // Actually, if ALL tokens failed but some were transient, we should retry.
      if (successCount === 0 && failureCount > 0 && response.responses.some(r => !r.success && r.error?.code !== 'messaging/invalid-registration-token' && r.error?.code !== 'messaging/registration-token-not-registered')) {
        // All failed, some retryable
        return { success: false, error: 'ALL_TOKENS_FAILED_TRANSIENT', isPermanentFailure: false };
      }

      return { success: true };
    } catch (error: any) {
      console.error('[FCM Adapter] Unexpected delivery error:', error);
      
      const errorCode = error.code || '';
      
      // Configuration/authentication failures should NOT be retried to avoid spam/loop
      if (
        errorCode.startsWith('auth/') || 
        errorCode === 'messaging/invalid-argument'
      ) {
        return { success: false, error: error.message, isPermanentFailure: true };
      }

      return { success: false, error: error.message || 'UNKNOWN_ERROR', isPermanentFailure: false };
    }
  }

  private buildMessage(notification: NotificationOutboxRow, tokens: string[]): MulticastMessage {
    let title = 'BBS Notification';
    let body = '';
    const payloadData = notification.payload as any;

    switch (notification.event_type) {
      case 'BOOKING_CONFIRMED':
        title = 'Booking Confirmed';
        body = `Your session on ${payloadData.slot_date} at ${payloadData.start_time} is confirmed.`;
        break;
      case 'BOOKING_REJECTED':
        title = 'Booking Rejected';
        body = `Your booking was rejected. Reason: ${payloadData.reason}`;
        break;
      case 'BOOKING_BBS_CANCELLED':
        title = 'Booking Cancelled';
        body = `Your booking was cancelled by Admin. Reason: ${payloadData.reason}`;
        break;
      case 'RESCHEDULE_APPROVED':
        title = 'Reschedule Approved';
        body = `Your booking was moved to ${payloadData.new_slot_date} at ${payloadData.new_start_time}.`;
        break;
      case 'RESCHEDULE_REJECTED':
        title = 'Reschedule Rejected';
        body = `Your reschedule request was rejected. Your original schedule remains.`;
        break;
      case 'MEMBERSHIP_ACTIVATED':
        title = 'Membership Activated';
        body = `Your ${payloadData.plan_name} membership is now active.`;
        break;
      default:
        body = 'You have a new notification.';
    }

    // Keep data payload strings only, required by FCM
    const dataPayload: Record<string, string> = {
      notification_type: notification.event_type,
    };
    if (payloadData.booking_id) dataPayload.booking_id = String(payloadData.booking_id);
    if (payloadData.membership_id) dataPayload.membership_id = String(payloadData.membership_id);

    return {
      notification: {
        title,
        body,
      },
      data: dataPayload,
      tokens,
    };
  }
}
