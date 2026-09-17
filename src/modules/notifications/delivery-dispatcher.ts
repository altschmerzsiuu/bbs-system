import type { NotificationOutboxRow, DeliveryResult, NotificationChannelAdapter } from './types';
import { FCMAdapter } from './adapters/fcm-adapter';
import type { OutboxRepository } from './outbox-repository';

export class DeliveryDispatcher {
  private readonly adapters: Record<string, NotificationChannelAdapter>;

  constructor(private readonly repository: OutboxRepository) {
    this.adapters = {
      'FCM': new FCMAdapter(),
      // 'EMAIL': new EmailAdapter(), // Future
      // 'WHATSAPP': new WhatsAppAdapter(), // Future
    };
  }

  async dispatch(notification: NotificationOutboxRow): Promise<DeliveryResult> {
    const adapter = this.adapters[notification.channel];
    
    if (!adapter) {
      return { 
        success: false, 
        error: `UNSUPPORTED_CHANNEL: ${notification.channel}`,
        isPermanentFailure: true 
      };
    }

    // For channels that require tokens (like FCM), fetch them.
    // If we add EMAIL/WHATSAPP, we might fetch user profile instead.
    let tokens: string[] = [];
    if (notification.channel === 'FCM') {
      tokens = await this.repository.getTokensForUser(notification.recipient_user_id);
    }

    try {
      return await adapter.deliver(notification, tokens);
    } catch (err: any) {
      console.error(`[DeliveryDispatcher] Unexpected error delivering ${notification.id}:`, err);
      // Assume unexpected errors are retryable unless proven otherwise
      return { success: false, error: err.message || 'UNKNOWN_ERROR', isPermanentFailure: false };
    }
  }
}
