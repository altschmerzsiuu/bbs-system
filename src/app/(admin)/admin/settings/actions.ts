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

export async function updateHorse(id: string, name: string) {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: 'Nama kuda tidak boleh kosong.' };
  const { error } = await db.from('horses').update({ name: trimmed }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/settings');
  revalidatePath('/admin/schedule');
  return { ok: true };
}

export async function deleteHorse(id: string) {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();

  // Lepaskan relasi pada sesi booking lampau agar tidak terhambat foreign key constraint
  await db.from('booking_participants').update({ horse_id: null }).eq('horse_id', id);

  const { error } = await db.from('horses').delete().eq('id', id);
  if (error) {
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
  max_weekly_bookings?: number;
  cancellation_hours?: number;
  photographer_enabled?: boolean;
}) {
  const actor = await requireActor(['ADMIN'], true);
  const db = await createServerClient();
  const { error } = await db.from('site_settings').update(settings).eq('id', 1);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/settings');
  revalidatePath('/admin/schedule');
  revalidatePath('/schedule');
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
