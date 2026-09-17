export type NotificationChannel = 'FCM' | 'EMAIL' | 'WHATSAPP';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface NotificationOutboxRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  recipient_user_id: string;
  channel: NotificationChannel;
  payload: any;
  status: NotificationStatus;
  attempts: number;
  available_at: string;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface DeliveryResult {
  success: boolean;
  error?: string;
  isPermanentFailure?: boolean;
}

export interface NotificationChannelAdapter {
  deliver(notification: NotificationOutboxRow, tokens: string[]): Promise<DeliveryResult>;
}
