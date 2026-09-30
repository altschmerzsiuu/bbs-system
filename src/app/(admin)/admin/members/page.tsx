import React from 'react';
import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import AdminMembersClient from './AdminMembersClient';

export default async function AdminMembersPage() {
  await requireActor(['ADMIN']);
  const db = await createServerClient();
  
  const { data: members, error } = await db
    .from('members')
    .select(`
      id,
      full_name,
      phone,
      created_at,
      memberships (
        id,
        status,
        end_date,
        allocated_credits,
        membership_plans ( name, code )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
  }

  return <AdminMembersClient members={members || []} />;
}
