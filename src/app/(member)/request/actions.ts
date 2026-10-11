'use server';

import { createServerClient, createServiceRoleClient } from '@/infrastructure/supabase-server';
import { getActor } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const requestSchema = z.object({
  fullName: z.string().min(3),
  phone: z.string().min(8),
  dateOfBirth: z.string(),
  domicile: z.string().min(2),
  heightCm: z.coerce.number().min(50).max(250),
  weightKg: z.coerce.number().min(20).max(200),
  shoeSize: z.coerce.number().optional().nullable(),
  requestType: z.enum(['CASUAL_RIDE', 'JOY_RIDE', 'MEMBERSHIP_APPLICATION']),
  planId: z.string().optional().nullable(),
  preferredDate: z.string().optional().nullable(),
  preferredTime: z.string().optional().nullable(),
});

export async function submitRequest(formData: FormData) {
  const actor = await getActor();
  if (!actor || !actor.memberId) {
    return { error: 'Unauthorized. Please login again.' };
  }

  const payload = {
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    dateOfBirth: formData.get('dateOfBirth'),
    domicile: formData.get('domicile'),
    heightCm: formData.get('heightCm'),
    weightKg: formData.get('weightKg'),
    shoeSize: formData.get('shoeSize'),
    requestType: formData.get('requestType'),
    planId: formData.get('planId'),
    preferredDate: formData.get('preferredDate'),
    preferredTime: formData.get('preferredTime'),
  };

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: 'Data tidak valid. Periksa kembali form Anda.' };
  }
  const data = parsed.data;

  if (data.requestType === 'MEMBERSHIP_APPLICATION' && !data.planId) {
    return { error: 'Pilih paket membership.' };
  }

  const db = await createServerClient();

  // 1. Update personal data
  const adminDb = createServiceRoleClient();
  const { error: profileError } = await adminDb
    .from('members')
    .update({
      full_name: data.fullName,
      phone: data.phone,
      date_of_birth: data.dateOfBirth,
      domicile: data.domicile,
      height_cm: data.heightCm,
      weight_kg: data.weightKg,
      shoe_size: data.shoeSize,
    })
    .eq('id', actor.memberId);

  if (profileError) {
    return { error: 'Gagal mengupdate profil.' };
  }

  // 2. Process Request
  let humanId = '';
  let recordId = '';

  if (data.requestType === 'MEMBERSHIP_APPLICATION') {
    const { MembershipService } = await import('@/modules/memberships/membership-service');
    const service = new MembershipService(db as any);
    try {
      const appResult = await service.submitApplication(actor as any, { planId: data.planId! });
      recordId = typeof appResult === 'string' ? appResult : appResult.id;
      humanId = typeof appResult === 'string' ? appResult : appResult.humanId;
    } catch (e: any) {
      console.error(e);
      return { error: e.message === 'DUPLICATE_APPLICATION' ? 'Anda sudah memiliki aplikasi/renewal aktif.' : 'Gagal membuat pengajuan membership.' };
    }
  } else {
    // Generate Human ID
    const today = new Date();
    const prefix = `BBS-REQ-${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    humanId = `${prefix}-${suffix}`;

    const { data: reqData, error: reqError } = await db
      .from('riding_requests')
      .insert({
        human_id: humanId,
        member_id: actor.memberId,
        request_type: data.requestType,
        preferred_date: data.preferredDate,
        preferred_time_start: data.preferredTime,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
        shoe_size: data.shoeSize,
      })
      .select('id')
      .single();

    if (reqError || !reqData) {
      console.error(reqError);
      return { error: 'Gagal mengirim request riding.' };
    }
    recordId = reqData.id;
  }

  const { data: admins } = await db.from('users').select('id').eq('role', 'ADMIN');
  if (admins && admins.length > 0) {
    const notifications = admins.map(admin => ({
      event_type: 'NEW_RIDING_REQUEST',
      aggregate_type: 'request',
      aggregate_id: recordId,
      recipient_user_id: admin.id,
      channel: 'FCM',
      payload: {
        request_id: humanId,
        type: data.requestType,
        member_name: data.fullName
      }
    }));
    await db.from('notification_outbox').insert(notifications);
  }

  revalidatePath('/', 'layout');
  
  return { 
    success: true, 
    requestId: humanId, 
    requestType: data.requestType 
  };
}

const membershipWizardSchema = z.object({
  fullName: z.string().min(3, 'Nama lengkap minimal 3 karakter'),
  phone: z.string().min(8, 'Nomor WhatsApp tidak valid'),
  dateOfBirth: z.string().min(1, 'Tanggal lahir wajib diisi'),
  domicile: z.string().min(2, 'Kota domisili wajib diisi'),
  heightCm: z.coerce.number().min(50).max(250),
  weightKg: z.coerce.number().min(20).max(200),
  shoeSize: z.coerce.number().optional().nullable(),
  planId: z.string().uuid('Pilih paket membership yang valid'),
});

export async function submitMembershipApplicationFlow(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  data?: {
    applicationId: string;
    humanId: string;
    planName: string;
    finalPriceIdr: number;
    createdAt: string;
  };
}> {
  const actor = await getActor();
  if (!actor || !actor.memberId) {
    return { ok: false, error: 'Sesi berakhir. Silakan login kembali.' };
  }

  const payload = {
    fullName: formData.get('fullName'),
    phone: formData.get('phone'),
    dateOfBirth: formData.get('dateOfBirth'),
    domicile: formData.get('domicile'),
    heightCm: formData.get('heightCm'),
    weightKg: formData.get('weightKg'),
    shoeSize: formData.get('shoeSize'),
    planId: formData.get('planId'),
  };

  const parsed = membershipWizardSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Data tidak valid.' };
  }
  const data = parsed.data;

  // Validate receipt file
  const file = formData.get('receipt') as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: 'Silakan upload bukti transfer pembayaran.' };
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { ok: false, error: 'Ukuran file bukti transfer maksimal 5MB.' };
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedMimeTypes.includes(file.type)) {
    return { ok: false, error: 'Format file harus JPG, PNG, WEBP, atau PDF.' };
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !/^(jpg|jpeg|png|webp|pdf)$/i.test(extension)) {
    return { ok: false, error: 'Ekstensi file tidak valid.' };
  }

  const adminDb = createServiceRoleClient();
  const db = await createServerClient();

  // 1. Update personal data
  const { error: profileError } = await adminDb
    .from('members')
    .update({
      full_name: data.fullName,
      phone: data.phone,
      date_of_birth: data.dateOfBirth,
      domicile: data.domicile,
      height_cm: data.heightCm,
      weight_kg: data.weightKg,
      shoe_size: data.shoeSize,
      updated_at: new Date().toISOString(),
    })
    .eq('id', actor.memberId);

  if (profileError) {
    console.error('profileError:', profileError);
    return { ok: false, error: 'Gagal mengupdate data diri.' };
  }

  // 2. Submit Application
  const { MembershipService } = await import('@/modules/memberships/membership-service');
  const service = new MembershipService(db as any);
  let appResult;
  try {
    appResult = await service.submitApplication(actor as any, { planId: data.planId });
  } catch (err: any) {
    console.error('submitApplication error:', err);
    if (err.message === 'DUPLICATE_APPLICATION') {
      return { ok: false, error: 'Anda sudah memiliki pengajuan membership yang aktif.' };
    }
    return { ok: false, error: 'Gagal membuat pengajuan membership.' };
  }

  const applicationId = typeof appResult === 'string' ? appResult : appResult.id;
  const humanId = typeof appResult === 'string' ? appResult : appResult.humanId;

  // 3. Upload receipt to storage
  const randomUuid = crypto.randomUUID();
  const filePath = `${actor.memberId}/${applicationId}/${randomUuid}.${extension}`;

  const { error: uploadError } = await db.storage
    .from('payment_proofs')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload Error:', uploadError);
    return { ok: false, error: 'Gagal mengunggah bukti pembayaran ke storage.' };
  }

  // 4. Update Application with Receipt & set status PAYMENT_SUBMITTED
  const serviceAdmin = new MembershipService(adminDb as any);
  try {
    await serviceAdmin.submitPaymentReceipt(
      actor as any,
      applicationId,
      filePath,
      file.name,
      'BANK_TRANSFER'
    );
  } catch (err: any) {
    console.error('submitPaymentReceipt error:', err);
    return { ok: false, error: 'Gagal mencatat bukti pembayaran.' };
  }

  // 5. Notify Admins
  const { data: admins } = await adminDb.from('users').select('id').eq('role', 'ADMIN');
  if (admins && admins.length > 0) {
    const notifications = admins.map(admin => ({
      event_type: 'PAYMENT_SUBMITTED',
      aggregate_type: 'membership_application',
      aggregate_id: applicationId,
      recipient_user_id: admin.id,
      channel: 'FCM',
      payload: {
        request_id: humanId,
        member_name: data.fullName,
      }
    }));
    await adminDb.from('notification_outbox').insert(notifications);
  }

  // Fetch plan details & final price
  const { data: createdApp } = await db
    .from('membership_applications')
    .select('final_price_idr, created_at, membership_plans(name)')
    .eq('id', applicationId)
    .single();

  revalidatePath('/membership');
  revalidatePath('/request');
  revalidatePath('/admin/applications');
  revalidatePath('/home');

  return {
    ok: true,
    data: {
      applicationId,
      humanId,
      planName: (createdApp?.membership_plans as any)?.name || 'Membership',
      finalPriceIdr: createdApp?.final_price_idr || 0,
      createdAt: createdApp?.created_at || new Date().toISOString(),
    }
  };
}
