'use server';

import { createServiceRoleClient, createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function updateProfile(formData: FormData) {
  const actor = await requireActor(['MEMBER']);
  // Use service role client to bypass RLS since members table doesn't have an UPDATE policy for members_self
  const db = createServiceRoleClient();

  const fullName = formData.get('fullName') as string;
  const phone = formData.get('phone') as string;
  const dob = formData.get('dob') as string;
  const email = formData.get('email') as string;
  const emergencyName = formData.get('emergencyName') as string;
  const emergencyPhone = formData.get('emergencyPhone') as string;

  // Update users table (full_name)
  const { error: userError } = await db
    .from('users')
    .update({ full_name: fullName, email })
    .eq('id', actor.userId);

  if (userError) {
    return { ok: false, message: userError.message };
  }

  // Update members table (full_name, phone, date_of_birth, emergency contact)
  if (actor.memberId) {
    const { error: memberError } = await db
      .from('members')
      .update({
        full_name: fullName,
        phone,
        date_of_birth: dob || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
      })
      .eq('id', actor.memberId);
      
    if (memberError) {
      return { ok: false, message: memberError.message };
    }
  }

  revalidatePath('/profile');
  return { ok: true, message: 'Profile updated' };
}

export async function uploadAvatar(formData: FormData) {
  const actor = await requireActor(['MEMBER']);
  // Use service role client for uploading to ensure it goes through regardless of RLS
  const db = createServiceRoleClient();
  const file = formData.get('avatar') as File;

  if (!file) return { ok: false, message: 'No file provided' };

  const ext = file.name.split('.').pop();
  const fileName = `${actor.userId}-${Date.now()}.${ext}`;

  const bucketName = 'bbs-profile-picture';

  const { error: uploadError } = await db.storage
    .from(bucketName)
    .upload(fileName, file, { upsert: true });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data: { publicUrl } } = db.storage.from(bucketName).getPublicUrl(fileName);

  const { error: userError } = await db
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', actor.userId);

  if (userError) {
    return { ok: false, message: userError.message };
  }

  revalidatePath('/profile');
  revalidatePath('/home');
  return { ok: true, url: publicUrl };
}
