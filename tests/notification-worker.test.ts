import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationWorker } from '../src/modules/notifications/notification-worker';
import { OutboxRepository } from '../src/modules/notifications/outbox-repository';
import { DeliveryDispatcher } from '../src/modules/notifications/delivery-dispatcher';
import type { NotificationOutboxRow } from '../src/modules/notifications/types';

describe('NotificationWorker (O4.5B Foundation)', () => {
  let repository: import('vitest').Mocked<OutboxRepository>;
  let dispatcher: import('vitest').Mocked<DeliveryDispatcher>;
  let worker: NotificationWorker;

  beforeEach(() => {
    repository = {
      claimPendingNotifications: vi.fn(),
      markSent: vi.fn(),
      markFailed: vi.fn(),
      getTokensForUser: vi.fn(),
    } as any;

    dispatcher = {
      dispatch: vi.fn(),
    } as any;

    worker = new NotificationWorker(repository, dispatcher);
  });

  const createDummyNotification = (id: string, attempts: number = 1): NotificationOutboxRow => ({
    id,
    event_type: 'TEST_EVENT',
    aggregate_type: 'test',
    aggregate_id: 'agg-123',
    recipient_user_id: 'user-123',
    channel: 'FCM',
    payload: { test: true },
    status: 'PENDING',
    attempts,
    available_at: new Date().toISOString(),
    sent_at: null,
    last_error: null,
    created_at: new Date().toISOString(),
  });

  it('should cleanly exit if there are no pending notifications', async () => {
    repository.claimPendingNotifications.mockResolvedValue([]);
    const result = await worker.processPending(10);
    expect(result).toEqual({ processed: 0, sent: 0, failed: 0 });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('should process a successful notification and mark it as sent with the correct attempts', async () => {
    const notif = createDummyNotification('notif-1', 1); // Emulates 'attempts=1' right after claim
    repository.claimPendingNotifications.mockResolvedValue([notif]);
    dispatcher.dispatch.mockResolvedValue({ success: true });
    repository.markSent.mockResolvedValue(true);

    const result = await worker.processPending(10);
    expect(result).toEqual({ processed: 1, sent: 1, failed: 0 });
    
    // Crucial safety check: markSent must pass the attempts down to prevent stale overwrites
    expect(repository.markSent).toHaveBeenCalledWith('notif-1', 1);
  });

  it('should properly schedule exponential backoff for retryable errors', async () => {
    const notif = createDummyNotification('notif-2', 2); // Emulates 2nd attempt
    repository.claimPendingNotifications.mockResolvedValue([notif]);
    dispatcher.dispatch.mockResolvedValue({ success: false, error: 'TIMEOUT', isPermanentFailure: false });
    repository.markFailed.mockResolvedValue(true);

    const result = await worker.processPending(10);
    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 });
    
    // Worker passes to repository.markFailed, which is responsible for setting max_attempts (5)
    expect(repository.markFailed).toHaveBeenCalledWith('notif-2', 2, 'TIMEOUT', false, 5);
  });

  it('should mark permanent failures without backoff', async () => {
    const notif = createDummyNotification('notif-3', 1);
    repository.claimPendingNotifications.mockResolvedValue([notif]);
    dispatcher.dispatch.mockResolvedValue({ success: false, error: 'NO_TOKENS', isPermanentFailure: true });
    repository.markFailed.mockResolvedValue(true);

    const result = await worker.processPending(10);
    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 });
    expect(repository.markFailed).toHaveBeenCalledWith('notif-3', 1, 'NO_TOKENS', true, 5);
  });

  it('should handle bounded concurrency without crashing', async () => {
    // Generate 12 notifications (limits are 5)
    const notifications = Array.from({ length: 12 }).map((_, i) => createDummyNotification(`notif-${i}`, 1));
    repository.claimPendingNotifications.mockResolvedValue(notifications);
    dispatcher.dispatch.mockResolvedValue({ success: true });
    repository.markSent.mockResolvedValue(true);

    const result = await worker.processPending(20);
    expect(result.processed).toBe(12);
    expect(result.sent).toBe(12);
    expect(result.failed).toBe(0);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(12);
    expect(repository.markSent).toHaveBeenCalledTimes(12);
  });

  it('should gracefully handle if markSent returns false (stale worker scenario)', async () => {
    const notif = createDummyNotification('notif-4', 1);
    repository.claimPendingNotifications.mockResolvedValue([notif]);
    dispatcher.dispatch.mockResolvedValue({ success: true });
    // Simulate what happens when the DB RPC returns false because attempts did not match
    repository.markSent.mockResolvedValue(false);

    const result = await worker.processPending(10);
    // Even though it dispatched, it shouldn't count as "sent" by THIS worker run
    // because the DB rejected it (meaning another worker took it)
    expect(result).toEqual({ processed: 1, sent: 0, failed: 0 });
  });
});
