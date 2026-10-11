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
  async submitApplication(actor: ActorContext, input: SubmitApplicationInput): Promise<{ id: string; humanId: string }> {
    if (!actor.memberId) throw new DomainError('FORBIDDEN');

    // 1. Check if user already has a pending or approved application (App layer check - DB index is the real guard)
    const { data: existingApp } = await this.db
      .from('membership_applications')
      .select('id')
      .eq('member_id', actor.memberId)
      .in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED'])
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

    // 4. Generate Human ID for Membership
    const today = new Date();
    const prefix = `BBS-MEM-${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const humanId = `${prefix}-${suffix}`;

    // 5. Create the application
    const initialStatus = isRenewal ? 'APPROVED' : 'PENDING_REVIEW';
    const { data: newApp, error: insertErr } = await this.db
      .from('membership_applications')
      .insert({
        human_id: humanId,
        member_id: actor.memberId,
        requested_plan_id: plan.id,
        previous_membership_id: latestMembership ? latestMembership.id : null,
        application_type: isRenewal ? 'RENEWAL' : 'NEW',
        base_price_idr: basePrice,
        discount_idr: discount,
        final_price_idr: finalPrice,
        status: initialStatus
      })
      .select('id')
      .single();

    this.rethrow(insertErr);
    return { id: newApp.id, humanId };
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

  async rejectApplication(actor: ActorContext, applicationId: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');

    const { error } = await this.db
      .from('membership_applications')
      .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
      .eq('id', applicationId)
      .in('status', ['PENDING_REVIEW', 'APPROVED']);

    this.rethrow(error);
  }

  /**
   * Member uploads a receipt.
   */
  async submitPaymentReceipt(
    actor: ActorContext,
    applicationId: string,
    receiptPath: string,
    receiptFilename: string,
    paymentMethod: string
  ): Promise<void> {
    if (!actor.memberId) throw new DomainError('FORBIDDEN');

    const { error } = await this.db
      .from('membership_applications')
      .update({
        status: 'PAYMENT_SUBMITTED',
        receipt_path: receiptPath,
        receipt_filename: receiptFilename,
        receipt_uploaded_at: new Date().toISOString(),
        payment_method: paymentMethod,
        rejection_reason: null, // Clear any previous rejection
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .eq('member_id', actor.memberId)
      .in('status', ['APPROVED', 'PENDING_REVIEW']);

    this.rethrow(error);
  }

  /**
   * Admin rejects a submitted payment.
   */
  async rejectPayment(actor: ActorContext, applicationId: string, reason: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');
    if (!reason || reason.trim() === '') throw new DomainError('INVALID_APPLICATION_STATUS');

    // 1. Update application back to APPROVED
    const { data: app, error: updateErr } = await this.db
      .from('membership_applications')
      .update({
        status: 'APPROVED',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .eq('status', 'PAYMENT_SUBMITTED')
      .select('members(user_id)')
      .single();

    this.rethrow(updateErr);

    if (app) {
      // 2. Notify member
      await this.db.from('notification_outbox').insert({
        event_type: 'PAYMENT_REJECTED',
        aggregate_type: 'membership_application',
        aggregate_id: applicationId,
        recipient_user_id: Array.isArray(app.members) ? app.members[0].user_id : (app.members as any).user_id,
        channel: 'FCM',
        payload: { reason }
      });
    }
  }

  /**
   * Admin confirms payment and activates in one atomic transaction (via RPC).
   */
  async confirmAndActivateMembership(actor: ActorContext, applicationId: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');

    // The RPC confirm_and_activate_membership does everything atomically.
    const { error } = await this.db.rpc('confirm_and_activate_membership', {
      p_application_id: applicationId,
      p_admin_id: actor.userId,
    });

    this.rethrow(error);
  }
}
