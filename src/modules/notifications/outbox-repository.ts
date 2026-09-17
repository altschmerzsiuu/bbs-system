import type { SupabaseClient } from '../../infrastructure/types';
import type { NotificationOutboxRow } from './types';

export class OutboxRepository {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Atomically claims pending notifications, setting a 5-minute lease.
   */
  async claimPendingNotifications(batchSize: number = 20): Promise<NotificationOutboxRow[]> {
    const { data, error } = await this.db.rpc('claim_pending_notifications', {
      p_batch_size: batchSize,
    });
    
    if (error) {
      console.error('[OutboxRepository] Failed to claim notifications:', error);
      return [];
    }

    return (data || []) as NotificationOutboxRow[];
  }

  /**
   * Finalizes a notification as SENT.
   * Ensures 'attempts' matches the claimed version to prevent stale finalize.
   */
  async markSent(id: string, attempts: number): Promise<boolean> {
    const { data, error } = await this.db.rpc('mark_notification_sent', {
      p_id: id,
      p_attempts: attempts,
    });
    
    if (error) {
      console.error(`[OutboxRepository] Failed to mark sent ${id}:`, error);
      return false;
    }
    
    return data as boolean;
  }

  /**
   * Finalizes a notification as FAILED (if permanent or max attempts)
   * or schedules a retry with exponential backoff.
   */
  async markFailed(
    id: string, 
    attempts: number, 
    errorMessage: string, 
    isPermanent: boolean, 
    maxAttempts: number = 5
  ): Promise<boolean> {
    const { data, error } = await this.db.rpc('mark_notification_failed', {
      p_id: id,
      p_attempts: attempts,
      p_error: errorMessage,
      p_is_permanent: isPermanent,
      p_max_attempts: maxAttempts,
    });

    if (error) {
      console.error(`[OutboxRepository] Failed to mark failed ${id}:`, error);
      return false;
    }

    return data as boolean;
  }

  /**
   * Retrieves active FCM tokens for a user.
   */
  async getTokensForUser(userId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', userId);

    if (error) {
      console.error(`[OutboxRepository] Failed to fetch tokens for user ${userId}:`, error);
      return [];
    }

    return (data || []).map((r: any) => r.token);
  }

  /**
   * Upserts an FCM token for a user.
   */
  async upsertToken(userId: string, token: string, deviceInfo: any = null): Promise<boolean> {
    const { error } = await this.db
      .from('fcm_tokens')
      .upsert({
        user_id: userId,
        token: token,
        device_info: deviceInfo,
        last_active: new Date().toISOString()
      }, { onConflict: 'token' });

    if (error) {
      console.error(`[OutboxRepository] Failed to upsert token for user ${userId}:`, error);
      return false;
    }
    return true;
  }

  /**
   * Deletes a specific FCM token.
   * If userId is provided, ensures only that user's token is deleted.
   */
  async deleteToken(token: string, userId?: string): Promise<boolean> {
    let query = this.db.from('fcm_tokens').delete().eq('token', token);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;
    if (error) {
      console.error(`[OutboxRepository] Failed to delete token:`, error);
      return false;
    }
    return true;
  }
}
