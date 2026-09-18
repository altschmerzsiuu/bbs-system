import React from 'react';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { BookingsClient } from './bookings-client';

export default async function BookingsPage() {
  const actor = await requireActor(['MEMBER']);
  const db    = await createServerClient();

  const { data: bookings } = await db
    .from('booking_participants')
    .select(`
      booking_id,
      bookings!inner (
        id, status, created_at, created_by,
        session_slots!inner ( slot_date, start_time, end_time )
      )
    `)
    .eq('member_id', actor.memberId!)
    .order('booking_id', { ascending: false });

  const list: any[] = (bookings ?? []).map((b: any) => b.bookings);

  return <BookingsClient list={list} currentUserId={actor.userId!} />;
}
