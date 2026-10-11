import { createServerClient, createServiceRoleClient } from '@/infrastructure/supabase-server';

import type {
  BookingStatus,
  MemberHomeState,
  MemberHomeViewModel,
  AdminScheduleParticipant,
  AdminScheduleBooking,
  AdminScheduleSlot,
  AdminSessionDetail,
  AdminSessionDetailBooking,
} from './booking-types';

export async function getMemberHome(memberId: string): Promise<MemberHomeViewModel> {
  const db = await createServerClient();

  // Fetch all necessary pieces in parallel
  const memberIdMatches = db.from('members').select('full_name').eq('id', memberId).single();
  
  // Chain the RPC call immediately after the active membership is fetched
  const activeMembershipPromise = db.from('memberships')
    .select('id, allocated_credits, end_date, membership_plans(name)')
    .eq('member_id', memberId)
    .eq('status', 'ACTIVE')
    .maybeSingle()
    .then(async (res) => {
      let state = null;
      if (res.data) {
        const rpcRes = await db.rpc('membership_credit_state', { p_membership_id: res.data.id });
        state = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
      }
      return { ...res, rpcState: state };
    });

  const [
    memberRes, 
    activeMembershipData, 
    expiredMembershipRes, 
    notifRes,
    activationNotifRes,
    appRes, 
    bookingRes, 
    recentRidesRes, 
    ridingRequestRes
  ] = await Promise.all([
    memberIdMatches,
    activeMembershipPromise,
    db.from('memberships')
      .select('id, allocated_credits, end_date, membership_plans(name)')
      .eq('member_id', memberId)
      .eq('status', 'EXPIRED')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    db.from('notifications')
      .select('id, title, body, data')
      .eq('event_type', 'MEMBERSHIP_ACTIVATED')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('membership_applications')
      .select('id, status, application_type, final_price_idr, membership_plans(name)')
      .eq('member_id', memberId)
      .in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED', 'PENDING_ACTIVATION'])
      .maybeSingle(),
    db.from('booking_participants')
      .select(`
        booking_id,
        bookings!inner (
          id, status,
          session_slots!bookings_slot_id_fkey!inner ( slot_date, start_time, end_time ),
          booking_participants ( members ( full_name ), casual_customers ( full_name ) )
        )
      `)
      .eq('member_id', memberId)
      .in('bookings.status', ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED'])
      .gte('bookings.session_slots.slot_date', new Date().toISOString().slice(0, 10))
      .order('slot_date', { referencedTable: 'bookings.session_slots', ascending: true }),
    db.from('booking_participants')
      .select(`
        id,
        horses ( name ),
        bookings!inner (
          session_slots!inner ( slot_date )
        ),
        attendance_records!inner ( status )
      `)
      .eq('member_id', memberId)
      .eq('attendance_records.status', 'ATTENDED')
      .not('horse_id', 'is', null)
      .limit(5),
    db.from('riding_requests')
      .select('id, request_type, status, preferred_date, preferred_time_start')
      .eq('member_id', memberId)
      .in('status', ['UNDER_REVIEW'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const activeRow = activeMembershipData.data as any;
  const expiredRow = expiredMembershipRes.data as any;
  const appData = appRes.data as any;
  const bookings = (bookingRes.data ?? []) as any[];
  const recentRidesData = (recentRidesRes.data ?? []) as any[];

  let resolvedMembership = null;
  let resolvedState: MemberHomeState = "NO_MEMBERSHIP"; // Default to S1

  // Determine ACTIVE membership and credits
  if (activeRow) {
    const s = activeMembershipData.rpcState;
    const available = s?.available ?? 0;

    resolvedMembership = {
      plan: activeRow.membership_plans?.name ?? '—',
      allocated: activeRow.allocated_credits,
      used: (s?.reserved ?? 0) + (s?.consumed ?? 0),
      available,
      endDate: activeRow.end_date,
    };

    if (appData?.status === 'PENDING_ACTIVATION') {
      resolvedState = "ACTIVE_WITH_RENEWAL"; // S8
    } else if (available > 0) {
      resolvedState = "ACTIVE"; // S5
    } else {
      resolvedState = "ACTIVE_NO_CREDITS"; // S6
    }
  } else if (appData) {
    // No active membership, but there is an application
    if (appData.status === 'PENDING_REVIEW') {
      resolvedState = "APPLICATION_PENDING"; // S2
    } else if (appData.status === 'APPROVED') {
      resolvedState = "PAYMENT_PENDING"; // S3
    } else if (appData.status === 'PAYMENT_CONFIRMED') {
      resolvedState = "ACTIVATION_PENDING"; // S4
    }
  } else if (expiredRow) {
    // No active membership, no application, but has expired membership
    resolvedMembership = {
      plan: expiredRow.membership_plans?.name ?? '—',
      allocated: expiredRow.allocated_credits,
      used: expiredRow.allocated_credits, // just for show
      available: 0,
      endDate: expiredRow.end_date,
    };
    resolvedState = "EXPIRED"; // S7
  }
  
  const localTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
  const now = new Date(localTimeStr);
  const validUpcomingBookings = bookings.filter((b: any) => {
    const slot = b.bookings.session_slots;
    const [year, month, day] = slot.slot_date.split('-').map(Number);
    const [endH, endM] = slot.end_time.split(':').map(Number);
    const endTime = new Date(year, month - 1, day, endH, endM, 0, 0);
    return endTime > now;
  }).sort((a: any, b: any) => {
    const slotA = a.bookings.session_slots;
    const slotB = b.bookings.session_slots;
    const dateA = new Date(`${slotA.slot_date}T${slotA.start_time}`);
    const dateB = new Date(`${slotB.slot_date}T${slotB.start_time}`);
    return dateA.getTime() - dateB.getTime();
  });

  const first = validUpcomingBookings[0]?.bookings;

  return {
    state: resolvedState,
    memberName: memberRes.data?.full_name ?? 'Rider',
    membership: resolvedMembership,
    application: appData
      ? {
        id: appData.id,
        status: appData.status,
        type: appData.application_type,
        planName: appData.membership_plans?.name ?? 'Plan',
        finalPrice: appData.final_price_idr,
      }
      : null,
    nextBooking: first
      ? {
        id: first.id,
        date: first.session_slots.slot_date,
        startTime: first.session_slots.start_time.slice(0, 5),
        endTime: first.session_slots.end_time.slice(0, 5),
        status: first.status,
        sharedWith: (first.booking_participants ?? [])
          .map((p: any) => p.members?.full_name ?? p.casual_customers?.full_name)
          .filter((n: string | undefined): n is string => Boolean(n) && n !== memberRes.data?.full_name),
      }
      : null,
    upcomingBookings: validUpcomingBookings.map((b: any) => ({
      id: b.bookings.id,
      date: b.bookings.session_slots.slot_date,
      startTime: b.bookings.session_slots.start_time.slice(0, 5),
      endTime: b.bookings.session_slots.end_time.slice(0, 5),
      status: b.bookings.status,
      sharedWith: (b.bookings.booking_participants ?? [])
        .map((p: any) => p.members?.full_name ?? p.casual_customers?.full_name)
        .filter((n: string | undefined): n is string => Boolean(n) && n !== memberRes.data?.full_name),
    })),
    upcomingCount: validUpcomingBookings.length,
    unreadNotifications: notifRes.count ?? 0,
    recentRides: recentRidesData.map((r: any) => ({
      id: r.id,
      date: r.bookings?.session_slots?.slot_date ?? '',
      horseName: r.horses?.name ?? null,
    })),
    pendingRideRequest: ridingRequestRes.data ? {
      id: ridingRequestRes.data.id,
      type: ridingRequestRes.data.request_type,
      status: ridingRequestRes.data.status,
      preferredDate: ridingRequestRes.data.preferred_date,
      preferredTime: ridingRequestRes.data.preferred_time_start
    } : null,
    activationNotification: activationNotifRes.data ? {
      id: activationNotifRes.data.id,
      title: activationNotifRes.data.title,
      body: activationNotifRes.data.body,
    } : null,
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

export async function getAdminSchedule(
  date: string
): Promise<AdminScheduleSlot[]> {
  const db = await createServerClient();

  /*
   * 1. Determine day of week.
   *
   * JS: Sunday = 0 ... Saturday = 6
   * This matches operating_schedules.day_of_week.
   */
  const selectedDate = new Date(`${date}T00:00:00`);
  const dayOfWeek = selectedDate.getDay();

  /*
   * 2. Fetch operating schedules and existing session slots
   *    for this date in parallel.
   */
  const [scheduleRes, slotsRes, requestsRes] = await Promise.all([
    db
      .from('operating_schedules')
      .select(`
        id,
        day_of_week,
        block,
        start_time,
        end_time,
        session_duration_minutes,
        slot_interval_minutes,
        default_capacity,
        is_active
      `)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .order('start_time', { ascending: true }),

    db
      .from('session_slots')
      .select(`
        id,
        slot_date,
        start_time,
        end_time,
        block,
        capacity,
        is_open,
        closed_reason,
        bookings!bookings_slot_id_fkey (
          id,
          status,
          notes,
          booking_participants (
            id,
            participant_type,
            member_id,
            membership_id,
            casual_customer_id,
            members (
              full_name,
              user_id,
              users (
                avatar_url
              )
            ),
            casual_customers (
              full_name
            )
          )
        )
      `)
      .eq('slot_date', date)
      .order('start_time', { ascending: true }),
      
    db
      .from('riding_requests')
      .select(`
        id,
        request_type,
        status,
        preferred_time_start,
        members ( full_name )
      `)
      .eq('preferred_date', date)
      .eq('status', 'UNDER_REVIEW')
  ]);

  if (scheduleRes.error) {
    console.error('[getAdminSchedule] operating_schedules:', scheduleRes.error);
    throw new Error('FAILED_TO_LOAD_OPERATING_SCHEDULE');
  }

  if (slotsRes.error) {
    console.error('[getAdminSchedule] session_slots:', slotsRes.error);
    throw new Error('FAILED_TO_LOAD_ADMIN_SCHEDULE');
  }

  if (requestsRes?.error) {
    console.error('[getAdminSchedule] riding_requests:', requestsRes.error);
  }

  const operatingSchedules = scheduleRes.data ?? [];
  const sessionSlots = slotsRes.data ?? [];
  const ridingRequests = requestsRes?.data ?? [];

  /*
   * 3. Build a quick lookup map for existing session slots and riding requests.
   *
   * Key:
   *   block + start_time
   *
   * Example:
   *   AFTERNOON|16:00:00
   */
  const slotMap = new Map<string, any>();
  const requestMap = new Map<string, any[]>();
  
  for (const req of ridingRequests as any[]) {
    // We group requests by preferred_time_start. 
    // They don't have block natively, so we just group by time
    const timeKey = req.preferred_time_start?.slice(0, 5); // "HH:MM"
    if (!timeKey) continue;
    
    if (!requestMap.has(timeKey)) {
      requestMap.set(timeKey, []);
    }
    requestMap.get(timeKey)!.push({
      id: req.id,
      memberName: req.members?.full_name || 'Unknown',
      type: req.request_type,
      status: req.status
    });
  }

  for (const slot of sessionSlots as any[]) {
    const key = `${slot.block}|${slot.start_time}`;
    slotMap.set(key, slot);
  }

  /*
   * 4. Generate the expected timeline from operating schedules.
   */
  const result: AdminScheduleSlot[] = [];

  for (const schedule of operatingSchedules as any[]) {
    const startMinutes = timeToMinutes(schedule.start_time);
    const endMinutes = timeToMinutes(schedule.end_time);

    for (
      let currentMinutes = startMinutes;
      currentMinutes < endMinutes;
      currentMinutes += schedule.slot_interval_minutes
    ) {
      const startTime = minutesToTime(currentMinutes);

      /*
       * Session duration determines the actual session end.
       *
       * Example:
       * 16:00 + 45 minutes = 16:45
       */
      const sessionEndMinutes =
        currentMinutes + schedule.session_duration_minutes;

      const endTime = minutesToTime(
        Math.min(sessionEndMinutes, endMinutes)
      );

      const slotKey = `${schedule.block}|${startTime}`;
      const existingSlot = slotMap.get(slotKey);
      
      const timeKey = startTime.slice(0, 5);
      const pendingRequests = requestMap.get(timeKey) ?? [];

      /*
       * No session_slots row yet.
       */
      if (!existingSlot) {
        result.push({
          id: null,
          date,
          startTime: timeKey,
          endTime: endTime.slice(0, 5),
          block: schedule.block,
          capacity: schedule.default_capacity,
          isOpen: true,
          closedReason: null,
          slotExists: false,
          booking: null,
          pendingRequests,
        });

        continue;
      }

      /*
       * Existing session_slots row.
       */
      const bookings = existingSlot.bookings ?? [];

      const participants = bookings.flatMap((booking: any) =>
        (booking.booking_participants ?? []).map(
          (participant: any) => ({
            id: participant.id,
            type: participant.participant_type,
            name:
              participant.participant_type === 'MEMBER'
                ? participant.members?.full_name ?? 'Unknown rider'
                : participant.casual_customers?.full_name ??
                'Casual rider',
            avatarUrl:
              participant.participant_type === 'MEMBER'
                ? participant.members?.users?.avatar_url ?? null
                : null,
            memberId: participant.member_id ?? null,
            membershipId: participant.membership_id ?? null,
            casualCustomerId:
              participant.casual_customer_id ?? null,
          })
        )
      );

      const bookingWithParticipants = bookings.find(
        (booking: any) =>
          (booking.booking_participants ?? []).length > 0
      );

      result.push({
        id: existingSlot.id,
        date: existingSlot.slot_date,
        startTime: existingSlot.start_time.slice(0, 5),
        endTime: existingSlot.end_time.slice(0, 5),
        block: existingSlot.block,
        capacity: existingSlot.capacity,
        isOpen: existingSlot.is_open,
        closedReason: existingSlot.closed_reason ?? null,
        slotExists: true,
        booking: bookingWithParticipants
          ? {
            id: bookingWithParticipants.id,
            status: bookingWithParticipants.status,
            notes: bookingWithParticipants.notes ?? null,
            participants,
          }
          : null,
        pendingRequests,
      });
    }
  }

  return result;
}

export async function getAdminSessionDetail(
  slotId: string
): Promise<AdminSessionDetail> {
  const db = await createServerClient();

  const { data, error } = await db
    .from('session_slots')
    .select(`
      id,
      slot_date,
      start_time,
      end_time,
      block,
      capacity,
      is_open,
      closed_reason,
      bookings!bookings_slot_id_fkey (
        id,
        status,
        notes,
        created_at,
        created_by,
        is_casual,
        cancellation_reason,
        cancelled_at,
        booking_participants (
          id,
          participant_type,
          member_id,
          membership_id,
          casual_customer_id,
          price_idr,
          horse_id,
          participant_status,
          attendance_records (
            status,
            resolved_at,
            resolved_by
          ),
          members (
            full_name,
            user_id,
            users (
              avatar_url
            )
          ),
          casual_customers (
            full_name
          ),
          horses (
            id,
            name,
            status
          )
        )
      )
    `)
    .eq('id', slotId)
    .single();

  if (error) {
    console.error('[getAdminSessionDetail]', error);
    throw new Error('FAILED_TO_LOAD_ADMIN_SESSION_DETAIL');
  }

  if (!data) {
    throw new Error('ADMIN_SESSION_NOT_FOUND');
  }

  const slot = data as any;

  const bookings: AdminSessionDetailBooking[] = (
    slot.bookings ?? []
  ).map((booking: any) => ({
    id: booking.id,
    status: booking.status,
    notes: booking.notes ?? null,
    createdAt: booking.created_at,
    createdBy: booking.created_by ?? null,
    isCasual: booking.is_casual,
    cancellationReason:
      booking.cancellation_reason ?? null,
    cancelledAt: booking.cancelled_at ?? null,

    participants: (
      booking.booking_participants ?? []
    ).map((participant: any) => ({
      id: participant.id,
      type: participant.participant_type,

      name:
        participant.participant_type === 'MEMBER'
          ? participant.members?.full_name ?? 'Unknown rider'
          : participant.casual_customers?.full_name ?? 'Casual rider',

      avatarUrl:
        participant.participant_type === 'MEMBER'
          ? participant.members?.users?.avatar_url ?? null
          : null,

      memberId: participant.member_id ?? null,
      membershipId: participant.membership_id ?? null,
      casualCustomerId: participant.casual_customer_id ?? null,

      participantStatus: participant.participant_status,
      requestedSlotId: booking.requested_slot_id ?? null,
      cancellationReason: booking.cancellation_reason ?? null,
      cancelledAt: booking.cancelled_at ?? null,

      attendanceStatus: participant.attendance_records?.[0]?.status ?? 'NOT_CHECKED_IN',
      checkedInAt: participant.attendance_records?.[0]?.resolved_at ?? null,
      checkedInBy: participant.attendance_records?.[0]?.resolved_by ?? null,
      checkInMethod: null,

      priceIdr: participant.price_idr ?? null,

      horseId: participant.horses?.id ?? null,
      horseName: participant.horses?.name ?? null,
    }))
  }));

  // Fetch pending riding requests for this slot
  const { data: reqData } = await db
    .from('riding_requests')
    .select('id, request_type, status, member_id, members(full_name, phone)')
    .eq('preferred_date', slot.slot_date)
    .eq('preferred_time_start', slot.start_time)
    .eq('status', 'UNDER_REVIEW');

  const pendingRequests = (reqData ?? []).map(r => {
    const mem = Array.isArray(r.members) ? r.members[0] : r.members;
    return {
      id: r.id,
      memberId: r.member_id,
      memberName: mem?.full_name || 'Unknown',
      memberPhone: mem?.phone || '',
      type: r.request_type,
      status: r.status
    };
  });

  return {
    id: slot.id,
    date: slot.slot_date,
    startTime: slot.start_time.slice(0, 5),
    endTime: slot.end_time.slice(0, 5),
    block: slot.block,

    capacity: slot.capacity,
    isOpen: slot.is_open,
    closedReason: slot.closed_reason ?? null,

    bookings,
    pendingRequests,
  };
}
export async function ensureSlotsForDateRange(startDate: string, endDate: string) {
  const db = await createServerClient();
  
  // Get all operating schedules and existing slots concurrently
  const [schedulesRes, existingRes] = await Promise.all([
    db.from('operating_schedules').select('*').eq('is_active', true),
    db
      .from('session_slots')
      .select('slot_date, start_time')
      .gte('slot_date', startDate)
      .lte('slot_date', endDate)
  ]);

  const schedules = schedulesRes.data;
  const existing = existingRes.data;

  if (!schedules || schedules.length === 0) return;
    
  const existingSet = new Set((existing || []).map(s => `${s.slot_date}|${s.start_time}`));
  const toInsert = [];

  // Iterate in UTC so the ISO date string and weekday always agree,
  // regardless of the server's local timezone.
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getUTCDay();
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek);
    
    for (const s of daySchedules) {
      const [startH, startM] = s.start_time.split(':').map(Number);
      const [endH, endM] = s.end_time.split(':').map(Number);
      
      let currentMs = (startH * 60 + startM) * 60000;
      const endMs = (endH * 60 + endM) * 60000;
      const intervalMs = s.slot_interval_minutes * 60000;
      const durationMs = s.session_duration_minutes * 60000;

      while (currentMs + durationMs <= endMs) {
        const slotStartH = Math.floor(currentMs / 3600000).toString().padStart(2, '0');
        const slotStartM = Math.floor((currentMs % 3600000) / 60000).toString().padStart(2, '0');
        const slotStartTime = `${slotStartH}:${slotStartM}:00`;

        const slotEndH = Math.floor((currentMs + durationMs) / 3600000).toString().padStart(2, '0');
        const slotEndM = Math.floor(((currentMs + durationMs) % 3600000) / 60000).toString().padStart(2, '0');
        const slotEndTime = `${slotEndH}:${slotEndM}:00`;

        if (!existingSet.has(`${dateStr}|${slotStartTime}`)) {
          toInsert.push({
            slot_date: dateStr,
            start_time: slotStartTime,
            end_time: slotEndTime,
            capacity: s.default_capacity,
            is_open: true,
            block: s.block
          });
        }
        currentMs += intervalMs;
      }
    }
  }

  if (toInsert.length > 0) {
    // session_slots is write-protected by RLS (admin only). Slot materialization
    // is a system action triggered by authenticated pages, so use service role.
    const { error } = await createServiceRoleClient()
      .from('session_slots')
      .upsert(toInsert, { onConflict: 'slot_date,start_time' });
    if (error) {
      console.error('[ensureSlotsForDateRange] upsert failed:', error);
    }
  }
}

export async function getPendingRequests() {
  const db = await createServerClient();
  const [riding, membership] = await Promise.all([
    db.from('riding_requests').select('id, request_type, status, created_at, member_id, height_cm, weight_kg, shoe_size, members(full_name, phone, date_of_birth, domicile, users(email, avatar_url))').eq('status', 'UNDER_REVIEW').order('created_at', { ascending: false }),
    db.from('membership_applications').select('id, status, application_type, created_at, requested_plan_id, final_price_idr, receipt_path, receipt_filename, rejection_reason, member_id, members(full_name, phone, users(email, avatar_url)), membership_plans(name)').in('status', ['PENDING_REVIEW', 'PAYMENT_SUBMITTED']).order('created_at', { ascending: false })
  ]);

  const ridingMapped = (riding.data || []).map(r => {
    const mem = Array.isArray(r.members) ? r.members[0] : r.members;
    return {
      id: r.id,
      category: 'riding',
      type: r.request_type,
      status: r.status,
      createdAt: r.created_at,
      memberId: r.member_id,
      memberName: mem?.full_name || 'Unknown',
      memberPhone: mem?.phone || '',
      memberEmail: ((Array.isArray(mem?.users) ? mem?.users[0] : mem?.users) as any)?.email || '',
      memberAvatarUrl: ((Array.isArray(mem?.users) ? mem?.users[0] : mem?.users) as any)?.avatar_url || '',
      planName: null,
      heightCm: r.height_cm,
      weightKg: r.weight_kg,
      shoeSize: r.shoe_size,
      dateOfBirth: mem?.date_of_birth || null,
      domicile: mem?.domicile || null
    };
  });

  const membershipMapped = (membership.data || []).map(r => {
    const mem = Array.isArray(r.members) ? r.members[0] : r.members;
    const plan = Array.isArray(r.membership_plans) ? r.membership_plans[0] : r.membership_plans;
    return {
      id: r.id,
      category: 'membership',
      type: 'MEMBERSHIP_APPLICATION',
      applicationType: r.application_type,
      status: r.status,
      createdAt: r.created_at,
      memberId: r.member_id,
      memberName: mem?.full_name || 'Unknown',
      memberPhone: mem?.phone || '',
      memberEmail: ((Array.isArray(mem?.users) ? mem?.users[0] : mem?.users) as any)?.email || '',
      memberAvatarUrl: ((Array.isArray(mem?.users) ? mem?.users[0] : mem?.users) as any)?.avatar_url || '',
      planName: plan?.name || 'Unknown Plan',
      finalPriceIdr: r.final_price_idr,
      receiptPath: r.receipt_path,
      receiptFilename: r.receipt_filename,
      rejectionReason: r.rejection_reason
    };
  });

  const allRequests = [...ridingMapped, ...membershipMapped].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return allRequests;
}
