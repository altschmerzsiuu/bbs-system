'use server';
import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import { revalidatePath } from 'next/cache';

export async function addHorse(name: string) {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const { error } = await db.from('horses').insert({ name, status: 'ACTIVE' });
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/settings');
  revalidatePath('/admin/schedule');
  return { ok: true };
}

export async function deleteHorse(id: string) {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const { error } = await db.from('horses').delete().eq('id', id);
  if (error) {
    // Usually foreign key constraint violation if horse is used in booking_participants
    if (error.code === '23503') {
      return { ok: false, message: 'Kuda ini sudah pernah digunakan dalam sesi dan tidak bisa dihapus secara permanen.' };
    }
    return { ok: false, message: error.message };
  }
  revalidatePath('/admin/settings');
  revalidatePath('/admin/schedule');
  return { ok: true };
}

export async function toggleHorseStatus(id: string, currentStatus: string) {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const { error } = await db.from('horses').update({ status: newStatus }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/settings');
  revalidatePath('/admin/schedule');
  return { ok: true };
}

export async function updateSiteSettings(settings: {
  reschedule_hours: number;
  admin_whatsapp: string;
}) {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const { error } = await db.from('site_settings').update(settings).eq('id', 1);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}

export async function updateAfternoonEndTime(endTime: string) {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const { error } = await db.from('operating_schedules').update({
    end_time: endTime
  }).eq('block', 'AFTERNOON');
  
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/settings');
  revalidatePath('/admin/schedule');
  return { ok: true };
}
