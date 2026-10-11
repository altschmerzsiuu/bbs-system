'use server';

import { revalidatePath } from 'next/cache';
import { MembershipService } from '@/modules/memberships/membership-service';
import { createServerClient, createServiceRoleClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { toClientError } from '@/domain/shared/errors';

export type ActionResult = { ok: true; id?: string } | { ok: false; code: string; message: string };

export async function submitMembershipApplication(planId: string, formData?: FormData): Promise<void> {
  const actor = await requireActor(['MEMBER'], true);
  const db = await createServerClient();
  const service = new MembershipService(db as never);
  await service.submitApplication(actor, { planId });
  revalidatePath('/membership');
  revalidatePath('/home');
}

export async function uploadPaymentReceiptAction(applicationId: string, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await requireActor(['MEMBER'], true);
    const db = await createServerClient();
    
    const file = formData.get('receipt') as File;
    if (!file) {
      return { ok: false, code: 'NO_FILE', message: 'No receipt file provided.' };
    }

    // 1. File Validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { ok: false, code: 'FILE_TOO_LARGE', message: 'File must be under 5MB.' };
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.type)) {
      return { ok: false, code: 'INVALID_FILE_TYPE', message: 'Only JPG, PNG, WEBP, or PDF allowed.' };
    }

    const extension = file.name.split('.').pop();
    if (!extension || !/^(jpg|jpeg|png|webp|pdf)$/i.test(extension)) {
      return { ok: false, code: 'INVALID_FILE_EXT', message: 'Invalid file extension.' };
    }

    // 2. Validate Application State & Ownership
    const { data: app, error: appErr } = await db
      .from('membership_applications')
      .select('status')
      .eq('id', applicationId)
      .eq('member_id', actor.memberId)
      .single();

    if (appErr || !app) {
      return { ok: false, code: 'NOT_FOUND', message: 'Application not found or unauthorized.' };
    }

    if (app.status !== 'APPROVED') {
      return { ok: false, code: 'INVALID_STATE', message: 'Application is not in a state to accept payment.' };
    }

    // 3. Generate secure path and upload to Storage
    const randomUuid = crypto.randomUUID();
    const filePath = `${actor.memberId}/${applicationId}/${randomUuid}.${extension}`;

    const { error: uploadError } = await db.storage
      .from('payment_proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      return { ok: false, code: 'UPLOAD_FAILED', message: 'Failed to upload receipt to storage.' };
    }

    // 4. Update DB via Service Role (bypassing RLS since we verified ownership above)
    const adminDb = await createServiceRoleClient();
    const service = new MembershipService(adminDb as never);
    await service.submitPaymentReceipt(
      actor,
      applicationId,
      filePath,
      file.name,
      'BANK_TRANSFER' // Currently hardcoded to BANK_TRANSFER as it's the only one
    );

    // 5. Trigger notification to Admins
    const { data: admins } = await db.from('users').select('id').eq('role', 'ADMIN');
    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        event_type: 'PAYMENT_SUBMITTED',
        aggregate_type: 'membership_application',
        aggregate_id: applicationId,
        recipient_user_id: admin.id,
        channel: 'FCM'
      }));
      await db.from('notification_outbox').insert(notifications);
    }

    revalidatePath('/membership');
    revalidatePath('/admin/applications');
    return { ok: true };
  } catch (err: any) {
    const error = toClientError(err);
    return { ok: false, code: error.code, message: error.message };
  }
}
