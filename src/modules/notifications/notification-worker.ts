import type { OutboxRepository } from './outbox-repository';
import type { DeliveryDispatcher } from './delivery-dispatcher';
import type { NotificationOutboxRow } from './types';

// Process a batch in small chunks to control concurrency
async function processInChunks<T, R>(
  items: T[], 
  chunkSize: number, 
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  return results;
}

export class NotificationWorker {
  // Bounded concurrency: maximum 5 concurrent deliveries at a time
  private readonly CONCURRENCY_LIMIT = 5;
  // Maximum retries before terminal FAILED state
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly dispatcher: DeliveryDispatcher
  ) {}

  /**
   * Main entrypoint for the cron job.
   * Claims pending notifications, processes them, and finalizes their states.
   */
  async processPending(batchSize: number = 20): Promise<{ processed: number; sent: number; failed: number }> {
    // 1. Claim a batch of rows. This applies an optimistic 5-minute lease in the DB.
    // If the worker crashes here, the lease will simply expire and rows will become PENDING again.
    const notifications = await this.repository.claimPendingNotifications(batchSize);
    
    if (notifications.length === 0) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    let sentCount = 0;
    let failedCount = 0;

    // 2. Process deliveries with bounded concurrency
    await processInChunks(notifications, this.CONCURRENCY_LIMIT, async (notification) => {
      // Dispatch handles adapter selection and actual delivery (e.g., FCM)
      const result = await this.dispatcher.dispatch(notification);

      // 3. Finalize the notification in the DB
      // We pass `notification.attempts` to prevent a stale worker from overwriting the status
      // if it somehow took longer than 5 minutes to deliver and another worker already claimed it.
      if (result.success) {
        const finalized = await this.repository.markSent(notification.id, notification.attempts);
        if (finalized) sentCount++;
      } else {
        const finalized = await this.repository.markFailed(
          notification.id,
          notification.attempts,
          result.error || 'UNKNOWN_ERROR',
          result.isPermanentFailure ?? false,
          this.MAX_ATTEMPTS
        );
        if (finalized) failedCount++;
      }
    });

    return {
      processed: notifications.length,
      sent: sentCount,
      failed: failedCount,
    };
  }
}
