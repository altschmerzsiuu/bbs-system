import React from 'react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { NotificationsClient } from './notifications-client';

export default async function NotificationsPage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const { data: notifications } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', actor.userId)
    .order('created_at', { ascending: false });

  const list = notifications ?? [];

  return (
    <NotificationsClient initialData={list} />
  );
}
