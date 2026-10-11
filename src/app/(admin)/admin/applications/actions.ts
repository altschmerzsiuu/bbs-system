'use server';

import { revalidatePath } from 'next/cache';
import { MembershipService } from '@/modules/memberships/membership-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { toClientError } from '@/domain/shared/errors';

export type ActionResult = { ok: true } | { ok: false; code: string; message: string };

export async function approveApplicationAction(applicationId: string, formData?: FormData): Promise<void> {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const service = new MembershipService(db as never);
  await service.approveApplication(actor, applicationId);
  revalidatePath('/admin/applications');
}

export async function rejectApplicationAction(applicationId: string, formData?: FormData): Promise<void> {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const service = new MembershipService(db as never);
  await service.rejectApplication(actor, applicationId);
  revalidatePath('/admin/applications');
}

export async function rejectPaymentAction(applicationId: string, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new MembershipService(db as never);
    
    const reason = formData.get('reason') as string;
    if (!reason || reason.trim() === '') {
      return { ok: false, code: 'MISSING_REASON', message: 'Rejection reason is required.' };
    }

    await service.rejectPayment(actor, applicationId, reason);
    revalidatePath('/admin/applications');
    return { ok: true };
  } catch (err: any) {
    const error = toClientError(err);
    return { ok: false, code: error.code, message: error.message };
  }
}

export async function confirmAndActivateMembershipAction(applicationId: string): Promise<ActionResult> {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new MembershipService(db as never);
    
    await service.confirmAndActivateMembership(actor, applicationId);
    revalidatePath('/admin/applications');
    return { ok: true };
  } catch (err: any) {
    const error = toClientError(err);
    return { ok: false, code: error.code, message: error.message };
  }
}

export async function getReceiptSignedUrlAction(path: string): Promise<{ ok: true, url: string } | { ok: false, message: string }> {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    
    // Create signed URL valid for 60 seconds
    const { data, error } = await db.storage
      .from('payment_proofs')
      .createSignedUrl(path, 60);
      
    if (error || !data) {
      return { ok: false, message: 'Failed to generate signed URL' };
    }
    
    return { ok: true, url: data.signedUrl };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Unauthorized' };
  }
}
