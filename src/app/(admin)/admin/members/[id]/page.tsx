
import React from 'react';
import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import AdminMemberDetailClient from './AdminMemberDetailClient';

export default async function AdminMemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActor(['ADMIN']);
  const db = await createServerClient();
  
  const { data: member, error } = await db
    .from('members')
    .select(`
      id,
      full_name,
      phone,
      created_at,
      emergency_contact_name,
      emergency_contact_phone,
      users ( email, avatar_url ),
      memberships (
        id,
        status,
        end_date,
        allocated_credits,
        membership_plans ( name, code )
      )
    `)
    .eq('id', id)
    .single();


  const { data: historyData } = await db
    .from('booking_participants')
    .select(`
      id,
      participant_status,
      attendance_records ( status ),
      bookings!inner (
        status,
        session_slots (
          slot_date,
          start_time,
          end_time
        )
      )
    `)
    .eq('member_id', id)
    .order('created_at', { ascending: false });

  // Process history data
  let totalSessions = 0;
  let attended = 0;
  let noShow = 0;
  
  const rawHistory = historyData || [];
  const riwayatSesi = rawHistory.map((bp: any) => {
    const b = bp.bookings;
    const s = b.session_slots;
    
    if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
        totalSessions++;
        const aStatus = bp.attendance_records?.[0]?.status;
        if (aStatus === 'ATTENDED') attended++;
        else if (aStatus === 'NO_SHOW') noShow++;
    }

    return {
      id: bp.id,
      date: s.slot_date,
      startTime: s.start_time,
      endTime: s.end_time,
      arena: 'Arena 01', // Mock
      horse: 'Bima', // Mock
      status: b.status === 'CONFIRMED' && s.slot_date < new Date().toISOString().split('T')[0] ? 'Selesai' : (b.status === 'CONFIRMED' ? 'Terkonfirmasi' : 'Selesai')
    };
  });
  
  // Sort descending by date and time
  riwayatSesi.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`).getTime();
      const dateB = new Date(`${b.date}T${b.startTime}`).getTime();
      return dateB - dateA;
  });

  const attendanceRate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
  
  const memberProps = {
    ...member,
    totalSessions,
    attendanceRate,
    noShowCount: noShow,
    riwayatSesi
  };


  if (error || !member) {
    return <div>Member not found</div>;
  }

  return <AdminMemberDetailClient member={memberProps} />;
}
