/** Minimal structural type so the domain/service layer never imports the
 *  Supabase SDK directly (Section 3: infrastructure stays swappable). */
export interface SupabaseClient {
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: any; error: any }>;
}
