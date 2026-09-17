import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FCMAdapter } from '../src/modules/notifications/adapters/fcm-adapter';
import type { NotificationOutboxRow } from '../src/modules/notifications/types';
import * as admin from 'firebase-admin';
import { OutboxRepository } from '../src/modules/notifications/outbox-repository';

// Mock dependencies
vi.mock('firebase-admin/app', () => {
  return {
    getApps: vi.fn(() => []),
    initializeApp: vi.fn(),
    cert: vi.fn(),
  };
});

vi.mock('firebase-admin/messaging', () => {
  return {
    getMessaging: vi.fn(),
  };
});

vi.mock('../src/infrastructure/supabase-server', () => ({
  createServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock('../src/modules/notifications/outbox-repository', () => {
  return {
    OutboxRepository: vi.fn(),
  };
});

describe('FCMAdapter', () => {
  let adapter: FCMAdapter;
  let mockSendEachForMulticast: any;
  let mockDeleteToken: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    adapter = new FCMAdapter();

    mockSendEachForMulticast = vi.fn();
    const { getMessaging } = await import('firebase-admin/messaging');
    (getMessaging as any).mockReturnValue({
      sendEachForMulticast: mockSendEachForMulticast,
    });

    mockDeleteToken = vi.fn().mockResolvedValue(true);
    (OutboxRepository as any).mockImplementation(() => ({
      deleteToken: mockDeleteToken,
    }));
  });

  const dummyNotification: NotificationOutboxRow = {
    id: 'notif-1',
    event_type: 'BOOKING_CONFIRMED',
    aggregate_type: 'booking',
    aggregate_id: 'booking-1',
    recipient_user_id: 'user-1',
    channel: 'FCM',
    payload: { slot_date: '2023-12-01', start_time: '14:00', booking_id: 'booking-1' },
    status: 'PENDING',
    attempts: 1,
    available_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    sent_at: null,
    last_error: null,
  };

  it('should return permanent failure if no tokens provided', async () => {
    const result = await adapter.deliver(dummyNotification, []);
    expect(result.success).toBe(false);
    expect(result.isPermanentFailure).toBe(true);
    expect(result.error).toBe('NO_TOKENS');
  });

  it('should deliver successfully to multiple tokens', async () => {
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });

    const result = await adapter.deliver(dummyNotification, ['token1', 'token2']);
    
    expect(result.success).toBe(true);
    expect(mockSendEachForMulticast).toHaveBeenCalledWith(expect.objectContaining({
      tokens: ['token1', 'token2'],
      notification: expect.objectContaining({ title: 'Booking Confirmed' }),
      data: expect.objectContaining({ notification_type: 'BOOKING_CONFIRMED', booking_id: 'booking-1' }),
    }));
  });

  it('should clean up dead tokens and succeed if at least one token succeeds', async () => {
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
      ],
    });

    const result = await adapter.deliver(dummyNotification, ['token1', 'token2']);
    
    expect(result.success).toBe(true); // Partial success is still outbox success
    expect(mockDeleteToken).toHaveBeenCalledWith('token2');
    expect(mockDeleteToken).not.toHaveBeenCalledWith('token1');
  });

  it('should return permanent failure if ALL tokens are dead', async () => {
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 0,
      failureCount: 2,
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
      ],
    });

    const result = await adapter.deliver(dummyNotification, ['token1', 'token2']);
    
    expect(result.success).toBe(false);
    expect(result.isPermanentFailure).toBe(true);
    expect(result.error).toBe('ALL_TOKENS_DEAD');
    
    expect(mockDeleteToken).toHaveBeenCalledWith('token1');
    expect(mockDeleteToken).toHaveBeenCalledWith('token2');
  });

  it('should return retryable failure if ALL tokens fail but some are transient', async () => {
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 0,
      failureCount: 2,
      responses: [
        { success: false, error: { code: 'messaging/invalid-registration-token' } }, // dead
        { success: false, error: { code: 'messaging/internal-error' } }, // transient
      ],
    });

    const result = await adapter.deliver(dummyNotification, ['token1', 'token2']);
    
    expect(result.success).toBe(false);
    expect(result.isPermanentFailure).toBe(false);
    expect(result.error).toBe('ALL_TOKENS_FAILED_TRANSIENT');
    
    expect(mockDeleteToken).toHaveBeenCalledWith('token1');
  });

  it('should return permanent failure on configuration error', async () => {
    mockSendEachForMulticast.mockRejectedValue({
      code: 'auth/invalid-credential',
      message: 'Invalid credential provided',
    });

    const result = await adapter.deliver(dummyNotification, ['token1']);
    
    expect(result.success).toBe(false);
    expect(result.isPermanentFailure).toBe(true);
    expect(result.error).toBe('Invalid credential provided');
  });
});
