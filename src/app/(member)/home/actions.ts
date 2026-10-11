'use server';

import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function markNotificationAsRead(notificationId: string) {
  const actor = await requireActor(['MEMBER']);
  const db = await createServerClient();
  
  await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', actor.userId);
    
  revalidatePath('/(member)/home', 'page');
  revalidatePath('/(member)/membership', 'page');
}
