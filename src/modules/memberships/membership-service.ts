import { DomainError } from '../../domain/shared/errors';
import type { SupabaseClient } from '../../infrastructure/types';
import type { ActorContext } from '../bookings/booking-service';

export interface SubmitApplicationInput {
  planId: string;
}

export class MembershipService {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Translates common database constraints or errors to DomainError.
   */
  private rethrow(error: { message?: string; code?: string } | null): never | void {
    if (!error) return;
    const msg = (error.message ?? '').trim();
    if (msg.includes('membership_apps_one_active_per_member')) {
      throw new DomainError('DUPLICATE_APPLICATION');
    }
    if (msg.includes('APPLICATION_NOT_FOUND')) {
      throw new DomainError('APPLICATION_NOT_FOUND');
    }
    if (msg.includes('INVALID_APPLICATION_STATUS')) {
      throw new DomainError('INVALID_APPLICATION_STATUS');
    }
    console.error('[MembershipService Error]', error);
    throw new Error('INTERNAL_ERROR');
  }

  /**
   * Submit an application for a membership plan. 
   * Handles both new applications and renewals depending on if the member has ANY historical membership.
   */
  async submitApplication(actor: ActorContext, input: SubmitApplicationInput): Promise<string> {
    if (!actor.memberId) throw new DomainError('FORBIDDEN');

    // 1. Check if user already has a pending or approved application (App layer check - DB index is the real guard)
    const { data: existingApp } = await this.db
      .from('membership_applications')
      .select('id')
      .eq('member_id', actor.memberId)
      .in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED'])
      .maybeSingle();

    if (existingApp) {
      throw new DomainError('DUPLICATE_APPLICATION');
    }

    // 2. Fetch plan details
    const { data: plan, error: planErr } = await this.db
      .from('membership_plans')
      .select('id, price_idr, extension_discount_idr')
      .eq('id', input.planId)
      .eq('is_active', true)
      .single();

    if (planErr || !plan) {
      throw new DomainError('PLAN_NOT_FOUND');
    }

    // 3. Determine if this is a renewal (fetch LATEST membership, regardless of status)
    const { data: latestMembership } = await this.db
      .from('memberships')
      .select('id')
      .eq('member_id', actor.memberId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const isRenewal = !!latestMembership;
    const basePrice = plan.price_idr;
    const discount = isRenewal ? plan.extension_discount_idr : 0;
    const finalPrice = basePrice - discount;

    // 4. Create the application
    const { data: newApp, error: insertErr } = await this.db
      .from('membership_applications')
      .insert({
        member_id: actor.memberId,
        requested_plan_id: plan.id,
        previous_membership_id: latestMembership ? latestMembership.id : null,
        application_type: isRenewal ? 'RENEWAL' : 'NEW',
        base_price_idr: basePrice,
        discount_idr: discount,
        final_price_idr: finalPrice,
        status: 'PENDING_REVIEW'
      })
      .select('id')
      .single();

    this.rethrow(insertErr);
    return newApp.id;
  }

  /**
   * Admin approves an application. It transitions to 'APPROVED'.
   */
  async approveApplication(actor: ActorContext, applicationId: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');

    const { error } = await this.db
      .from('membership_applications')
      .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
      .eq('id', applicationId)
      .eq('status', 'PENDING_REVIEW');

    this.rethrow(error);
  }

  /**
   * Admin confirms payment received. It transitions to 'PAYMENT_CONFIRMED'.
   */
  async confirmPayment(actor: ActorContext, applicationId: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');

    const { error } = await this.db
      .from('membership_applications')
      .update({ status: 'PAYMENT_CONFIRMED', updated_at: new Date().toISOString() })
      .eq('id', applicationId)
      .eq('status', 'APPROVED');

    this.rethrow(error);
  }

  /**
   * Admin activates membership. 
   * - Calls Postgres RPC for atomic creation, ledger initialization, and status transition.
   * - Preserves existing active memberships (early renewal).
   */
  async activateMembership(actor: ActorContext, applicationId: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');

    const { error } = await this.db.rpc('activate_membership', {
      p_application_id: applicationId,
      p_admin_id: actor.userId,
    });

    this.rethrow(error);
  }

  async rejectApplication(actor: ActorContext, applicationId: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');

    const { error } = await this.db
      .from('membership_applications')
      .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
      .eq('id', applicationId)
      .in('status', ['PENDING_REVIEW', 'APPROVED']);

    this.rethrow(error);
  }
}
