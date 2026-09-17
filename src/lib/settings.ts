import { z } from 'zod';
import type { SupabaseClient } from '../infrastructure/types.js';

/**
 * Section 35 — typed access to system_settings. Defaults mirror the locked
 * product values so a missing row degrades safely instead of guessing.
 */
export const SETTING_DEFAULTS = {
  booking_window_days: 7,
  max_active_future_bookings: 2,
  cancellation_deadline_hours: 6,
  default_session_capacity: 2,
  pending_timeout_minutes: 1440,
  slot_interval_minutes: 60,
  session_duration_minutes: 45,
  casual_price_idr: 200_000,
  slot_generation_horizon_days: 30,
  sync_max_attempts: 5,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

const numeric = z.coerce.number().int().nonnegative();

export async function getSetting(db: SupabaseClient, key: SettingKey): Promise<number> {
  const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle();
  const parsed = numeric.safeParse(data?.value);
  return parsed.success ? parsed.data : SETTING_DEFAULTS[key];
}
