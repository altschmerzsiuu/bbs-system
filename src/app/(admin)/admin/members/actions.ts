'use server';

import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import { revalidatePath } from 'next/cache';

export async function addMemberAction(data: {
  fullName: string;
  phone: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}) {
  try {
    await requireActor(['ADMIN'], true);
    const db = await createServerClient();

    const { error } = await db.from('members').insert({
      full_name: data.fullName.trim(),
      phone: data.phone.trim(),
      emergency_contact_name: data.emergencyContactName?.trim() || null,
      emergency_contact_phone: data.emergencyContactPhone?.trim() || null,
    });

    if (error) {
      console.error('[addMemberAction]', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/admin/members');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e.message || 'Unknown error' };
  }
}
