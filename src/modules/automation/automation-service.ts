import type { SupabaseClient } from '../../infrastructure/types';

export class AutomationService {
  constructor(private readonly db: SupabaseClient) {}

  async runDailyMaintenance(): Promise<{ expired: number; activated: number; skipped: number; executedAt: string }> {
    const { data, error } = await this.db.rpc('daily_maintenance');
    if (error) throw new Error(error.message);
    
    return {
      expired: data.memberships_expired,
      activated: data.memberships_activated,
      skipped: data.memberships_skipped,
      executedAt: data.executed_at,
    };
  }

  async expirePendingBookings(): Promise<number> {
    const { data, error } = await this.db.rpc('expire_pending_bookings');
    if (error) throw new Error(error.message);
    return data as number;
  }
}
