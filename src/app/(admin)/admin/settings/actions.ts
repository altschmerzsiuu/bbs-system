'use server';
import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import { revalidatePath } from 'next/cache';

export async function addHorse(name: string) {
  const actor = await requireActor(['ADMIN']);
  const db = await createServerClient();
  const { error } = await db.from('horses').insert({ name, status: 'ACTIVE' });
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/settings');
  revalidatePath('/admin/schedule');
  return { ok: true };
}

export async function toggleHorseStatus(id: string, currentStatus: string) {
  const actor = await requireActor(['ADMIN']);
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
  package_validity_months: number;
  admin_whatsapp: string;
}) {
  const actor = await requireActor(['ADMIN']);
  const db = await createServerClient();
  const { error } = await db.from('site_settings').update(settings).eq('id', 1);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin/settings');
  // Might want to revalidate root layout or anything depending on it later
  return { ok: true };
}
