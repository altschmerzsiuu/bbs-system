'use server';

import { createServerClient } from '@/infrastructure/supabase-server';
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
  if ((data.requestType === 'CASUAL_RIDE' || data.requestType === 'JOY_RIDE') && (!data.preferredDate || !data.preferredTime)) {
    return { error: 'Pilih jadwal riding yang tersedia.' };
  }

  const db = await createServerClient();

  // 1. Update personal data
  const { error: profileError } = await db
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

  if (data.requestType === 'MEMBERSHIP_APPLICATION') {
    // Determine Base Price
    const { data: planData } = await db.from('membership_plans').select('price_idr').eq('id', data.planId!).single();
    if (!planData) return { error: 'Paket tidak valid' };

    // Generate Human ID for Membership
    const today = new Date();
    const prefix = `BBS-MEM-${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    humanId = `${prefix}-${suffix}`;

    const { data: appData, error: appError } = await db
      .from('membership_applications')
      .insert({
        human_id: humanId,
        member_id: actor.memberId,
        membership_plan_id: data.planId!,
        base_price_idr: planData.price_idr,
        final_price_idr: planData.price_idr,
      })
      .select('human_id')
      .single();

    if (appError || !appData) {
      return { error: 'Gagal membuat pengajuan membership.' };
    }
    humanId = appData.human_id;

  } else {
    // Generate Human ID
    const today = new Date();
    const prefix = `BBS-REQ-${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    humanId = `${prefix}-${suffix}`;

    const { error: reqError } = await db
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
      });

    if (reqError) {
      console.error(reqError);
      return { error: 'Gagal mengirim request riding.' };
    }
  }

  revalidatePath('/', 'layout');
  
  return { 
    success: true, 
    requestId: humanId, 
    requestType: data.requestType 
  };
}
