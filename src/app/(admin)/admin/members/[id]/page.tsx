import React from 'react';
import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import AdminMemberDetailClient from './AdminMemberDetailClient';

export default async function AdminMemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActor(['ADMIN']);
  const db = await createServerClient();
  
  const [memberRes, historyRes, appsRes] = await Promise.all([
    db
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
          start_date,
          price_paid_idr,
          membership_plans ( name, code )
        )
      `)
      .eq('id', id)
      .single(),

    db
      .from('booking_participants')
      .select(`
        id,
        participant_status,
        horse_id,
        horses ( name ),
        attendance_records ( status ),
        bookings!inner (
          id,
          status,
          session_slots!bookings_slot_id_fkey (
            id,
            slot_date,
            start_time,
            end_time
          )
        )
      `)
      .eq('member_id', id)
      .order('created_at', { ascending: false }),

    db
      .from('membership_applications')
      .select(`
        id,
        status,
        application_type,
        created_at,
        final_price_idr,
        receipt_path,
        receipt_filename,
        requested_plan_id,
        membership_plans ( name, credits )
      `)
      .eq('member_id', id)
      .order('created_at', { ascending: false })
  ]);

  const member = memberRes.data;
  if (memberRes.error || !member) {
    return <div>Member not found</div>;
  }

  // Active membership & real credit state via RPC
  const activeMs = member.memberships?.find((ms: any) => ms.status === 'ACTIVE');
  let remainingCredits = 0;
  let usedCredits = 0;
  let allocatedCredits = activeMs?.allocated_credits || 10;

  if (activeMs) {
    const { data: rpcData } = await db.rpc('membership_credit_state', { p_membership_id: activeMs.id });
    const s = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (s) {
      allocatedCredits = s.allocated ?? allocatedCredits;
      remainingCredits = s.available ?? 0;
      usedCredits = (s.reserved ?? 0) + (s.consumed ?? 0);
    }
  }

  // Process history data
  let totalSessions = 0;
  let attended = 0;
  let noShow = 0;

  const rawHistory = historyRes.data || [];
  const riwayatSesi = rawHistory
    .map((bp: any) => {
      const b = bp.bookings;
      const s = b?.session_slots;
      if (!s) return null;

      const aStatus = bp.attendance_records?.[0]?.status;
      if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
        totalSessions++;
        if (aStatus === 'ATTENDED') attended++;
        else if (aStatus === 'NO_SHOW') noShow++;
      }

      let statusDisplay = 'Terkonfirmasi';
      let statusVariant: 'confirmed' | 'pending' | 'completed' | 'cancelled' = 'confirmed';

      if (b.status === 'COMPLETED' || aStatus === 'ATTENDED') {
        statusDisplay = 'Selesai';
        statusVariant = 'completed';
      } else if (b.status === 'MEMBER_CANCELLED' || b.status === 'BBS_CANCELLED') {
        statusDisplay = 'Dibatalkan';
        statusVariant = 'cancelled';
      } else if (b.status === 'REJECTED') {
        statusDisplay = 'Ditolak';
        statusVariant = 'cancelled';
      } else if (b.status === 'PENDING') {
        statusDisplay = 'Menunggu Approval';
        statusVariant = 'pending';
      } else if (b.status === 'RESCHEDULE_REQUESTED') {
        statusDisplay = 'Menunggu Reschedule';
        statusVariant = 'pending';
      } else if (s.slot_date < new Date().toISOString().split('T')[0]) {
        statusDisplay = aStatus === 'NO_SHOW' ? 'Tidak Hadir' : 'Selesai';
        statusVariant = aStatus === 'NO_SHOW' ? 'cancelled' : 'completed';
      }

      return {
        id: bp.id,
        bookingId: b.id,
        date: s.slot_date,
        startTime: s.start_time,
        endTime: s.end_time,
        arena: 'Arena 01',
        horse: bp.horses?.name || 'Belum di-assign',
        status: statusDisplay,
        statusVariant,
        rawStatus: b.status
      };
    })
    .filter(Boolean) as any[];

  // Sort descending by date and time
  riwayatSesi.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.startTime}`).getTime();
    const dateB = new Date(`${b.date}T${b.startTime}`).getTime();
    return dateB - dateA;
  });

  const attendanceRate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

  // Real payment history from membership applications
  const rawApps = appsRes.data || [];
  const payments = await Promise.all(
    rawApps.map(async (app: any) => {
      let proofUrl: string | null = null;
      if (app.receipt_path) {
        const { data: signData } = await db.storage
          .from('payment_proofs')
          .createSignedUrl(app.receipt_path, 3600);
        proofUrl = signData?.signedUrl || null;
      }

      return {
        id: app.id,
        date: app.created_at,
        package: app.membership_plans?.name || 'Paket Membership',
        price: `Rp ${Number(app.final_price_idr || 0).toLocaleString('id-ID')}`,
        rawPrice: app.final_price_idr,
        method: 'Transfer Bank / QRIS',
        status: app.status === 'ACTIVATED' ? 'Lunas' : app.status,
        proofUrl
      };
    })
  );

  const memberProps = {
    ...member,
    totalSessions,
    attendanceRate,
    noShowCount: noShow,
    remainingCredits,
    usedCredits,
    allocatedCredits,
    riwayatSesi,
    payments
  };

  return <AdminMemberDetailClient member={memberProps} />;
}
