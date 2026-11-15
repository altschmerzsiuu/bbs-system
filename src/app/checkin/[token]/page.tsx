export const dynamic = 'force-dynamic';

import React from 'react';
import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { createServiceRoleClient } from '@/infrastructure/supabase-server';
import { CheckinClient, type CheckinTicketViewModel } from './checkin-client';

export default async function CheckinTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const actor = await requireActor(['ADMIN', 'GROOMER']);
  const { token } = await params;
  const cleanToken = (token || '').trim();
  if (!cleanToken) notFound();

  const adminDb = createServiceRoleClient();

  const { data: horsesData } = await adminDb
    .from('horses')
    .select('id, name')
    .eq('status', 'ACTIVE')
    .order('name');
  const horses = (horsesData || []) as { id: string; name: string }[];

  const selectQuery = `
    id,
    human_id,
    public_token,
    request_type,
    preferred_date,
    preferred_time_start,
    height_cm,
    weight_kg,
    shoe_size,
    status,
    booking_id,
    casual_customers (
      full_name,
      phone
    ),
    members (
      full_name,
      phone
    ),
    bookings (
      id,
      status,
      slot_id,
      session_slots (
        id,
        slot_date,
        start_time,
        end_time
      ),
      booking_participants (
        id,
        participant_type,
        price_idr,
        attendance_status,
        checked_in_at,
        horse_id,
        horses (
          id,
          name
        ),
        attendance_records (
          id,
          status
        )
      )
    )
  `;

  let { data: reqRow, error: reqErr } = await adminDb
    .from('riding_requests')
    .select(selectQuery)
    .eq('public_token', cleanToken)
    .maybeSingle();

  if ((reqErr || !reqRow) && /^REQ-\d{4}$/i.test(cleanToken)) {
    const byHuman = await adminDb
      .from('riding_requests')
      .select(selectQuery)
      .eq('human_id', cleanToken.toUpperCase())
      .maybeSingle();
    if (!byHuman.error && byHuman.data) reqRow = byHuman.data as any;
  }

  if ((reqErr || !reqRow) && /^[0-9a-fA-F-]{36}$/.test(cleanToken)) {
    const byId = await adminDb
      .from('riding_requests')
      .select(selectQuery)
      .eq('id', cleanToken)
      .maybeSingle();
    if (!byId.error && byId.data) reqRow = byId.data as any;
  }

  // Fallback query without migration 0053 columns if needed
  if (!reqRow) {
    const fallbackSelect = `
      id,
      human_id,
      request_type,
      preferred_date,
      preferred_time_start,
      height_cm,
      weight_kg,
      shoe_size,
      status,
      casual_customers (
        full_name,
        phone
      ),
      members (
        full_name,
        phone
      )
    `;
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(cleanToken);
    const fallbackRes = await adminDb
      .from('riding_requests')
      .select(fallbackSelect)
      .eq(isUuid ? 'id' : 'human_id', isUuid ? cleanToken : cleanToken.toUpperCase())
      .maybeSingle();
    if (fallbackRes.data) reqRow = fallbackRes.data as any;
  }

  if (!reqRow) {
    // Check if cleanToken is a direct Member/Casual booking_id (from Member E-Ticket QR)
    if (/^[0-9a-fA-F-]{36}$/.test(cleanToken)) {
      const { data: directBooking } = await adminDb
        .from('bookings')
        .select(`
          id,
          status,
          slot_id,
          is_casual,
          session_slots (
            id,
            slot_date,
            start_time,
            end_time
          ),
          booking_participants (
            id,
            participant_type,
            price_idr,
            attendance_status,
            checked_in_at,
            horse_id,
            members (
              full_name,
              phone,
              height_cm,
              weight_kg,
              shoe_size
            ),
            casual_customers (
              full_name,
              phone,
              height_cm,
              weight_kg,
              shoe_size
            ),
            horses (
              id,
              name
            ),
            attendance_records (
              id,
              status
            )
          )
        `)
        .eq('id', cleanToken)
        .maybeSingle();

      if (directBooking) {
        const dSlot = Array.isArray((directBooking as any).session_slots)
          ? (directBooking as any).session_slots[0]
          : (directBooking as any).session_slots;
        const dPart = (directBooking as any).booking_participants?.[0] || null;
        const dMember = dPart?.members
          ? Array.isArray(dPart.members)
            ? dPart.members[0]
            : dPart.members
          : null;
        const dCasual = dPart?.casual_customers
          ? Array.isArray(dPart.casual_customers)
            ? dPart.casual_customers[0]
            : dPart.casual_customers
          : null;
        const dHorse = dPart?.horses
          ? Array.isArray(dPart.horses)
            ? dPart.horses[0]
            : dPart.horses
          : null;
        const dAttRec = dPart?.attendance_records
          ? Array.isArray(dPart.attendance_records)
            ? dPart.attendance_records[0]
            : dPart.attendance_records
          : null;

        const isAttended =
          dAttRec?.status === 'ATTENDED' || dPart?.attendance_status === 'ATTENDED';

        const memberViewModel: CheckinTicketViewModel = {
          requestId: directBooking.id,
          humanId: `PASS #${directBooking.id.slice(0, 8).toUpperCase()}`,
          publicToken: directBooking.id,
          requestStatus: directBooking.status === 'CONFIRMED' || directBooking.status === 'COMPLETED' ? 'CONFIRMED' : directBooking.status,
          serviceName: dPart?.participant_type === 'MEMBER' ? 'Sesi Member' : 'Casual / Fun Ride',
          riderName: dMember?.full_name || dCasual?.full_name || 'Rider BBS',
          riderPhone: dMember?.phone || dCasual?.phone || '-',
          riderType: dPart?.participant_type === 'CASUAL' ? 'CASUAL' : 'MEMBER',
          heightCm: Number(dMember?.height_cm || dCasual?.height_cm) || 0,
          weightKg: Number(dMember?.weight_kg || dCasual?.weight_kg) || 0,
          shoeSize: dMember?.shoe_size ?? dCasual?.shoe_size ?? null,
          date: dSlot?.slot_date || '-',
          startTime: String(dSlot?.start_time || '').slice(0, 5),
          endTime: dSlot?.end_time ? String(dSlot.end_time).slice(0, 5) : null,
          slotId: dSlot?.id || directBooking.slot_id || null,
          bookingId: directBooking.id,
          participantId: dPart?.id || null,
          priceIdr: Number(dPart?.price_idr) || 0,
          horseId: dPart?.horse_id || dHorse?.id || null,
          horseName: dHorse?.name || null,
          attendanceStatus: isAttended ? 'ATTENDED' : 'NOT_CHECKED_IN',
          checkedInAt: dPart?.checked_in_at || null,
        };

        return (
          <CheckinClient
            ticket={memberViewModel}
            horses={horses}
            actorRole={actor.role}
          />
        );
      }
    }

    notFound();
  }

  const casual = Array.isArray((reqRow as any).casual_customers)
    ? (reqRow as any).casual_customers[0]
    : (reqRow as any).casual_customers;
  const member = Array.isArray((reqRow as any).members)
    ? (reqRow as any).members[0]
    : (reqRow as any).members;

  let bookingObj: any = Array.isArray((reqRow as any).bookings)
    ? (reqRow as any).bookings[0]
    : (reqRow as any).bookings;

  if (!bookingObj && reqRow.status === 'CONFIRMED') {
    const { data: noteBooking } = await adminDb
      .from('bookings')
      .select(`
        id,
        status,
        slot_id,
        session_slots (
          id,
          slot_date,
          start_time,
          end_time
        ),
        booking_participants (
          id,
          participant_type,
          price_idr,
          attendance_status,
          checked_in_at,
          horse_id,
          horses (
            id,
            name
          ),
          attendance_records (
            id,
            status
          )
        )
      `)
      .ilike('notes', `%${reqRow.human_id}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (noteBooking) {
      bookingObj = noteBooking;
    }
  }

  const slot = bookingObj?.session_slots
    ? Array.isArray(bookingObj.session_slots)
      ? bookingObj.session_slots[0]
      : bookingObj.session_slots
    : null;

  const participant = bookingObj?.booking_participants?.[0] || null;
  const horseObj = participant?.horses
    ? Array.isArray(participant.horses)
      ? participant.horses[0]
      : participant.horses
    : null;
  const attRec = participant?.attendance_records
    ? Array.isArray(participant.attendance_records)
      ? participant.attendance_records[0]
      : participant.attendance_records
    : null;

  const effectiveAttendance =
    attRec?.status === 'ATTENDED' || participant?.attendance_status === 'ATTENDED'
      ? 'ATTENDED'
      : 'NOT_CHECKED_IN';

  const viewModel: CheckinTicketViewModel = {
    requestId: reqRow.id,
    humanId: reqRow.human_id,
    publicToken: (reqRow as any).public_token || reqRow.id,
    requestStatus: reqRow.status,
    serviceName: reqRow.request_type === 'JOY_RIDE' ? 'Joy Ride' : 'Casual / Fun Ride',
    riderName: casual?.full_name || member?.full_name || 'Tamu BBS',
    riderPhone: casual?.phone || member?.phone || '-',
    riderType: casual ? 'CASUAL' : 'MEMBER',
    heightCm: Number(reqRow.height_cm) || 0,
    weightKg: Number(reqRow.weight_kg) || 0,
    shoeSize: reqRow.shoe_size ?? null,
    date: slot?.slot_date || reqRow.preferred_date,
    startTime: String(slot?.start_time || reqRow.preferred_time_start || '').slice(0, 5),
    endTime: slot?.end_time ? String(slot.end_time).slice(0, 5) : null,
    slotId: slot?.id || bookingObj?.slot_id || null,
    bookingId: bookingObj?.id || null,
    participantId: participant?.id || null,
    priceIdr: Number(participant?.price_idr) || (reqRow.request_type === 'JOY_RIDE' ? 150000 : 250000),
    horseId: participant?.horse_id || horseObj?.id || null,
    horseName: horseObj?.name || null,
    attendanceStatus: effectiveAttendance,
    checkedInAt: participant?.checked_in_at || null,
  };

  return (
    <CheckinClient
      ticket={viewModel}
      horses={horses}
      actorRole={actor.role}
    />
  );
}
